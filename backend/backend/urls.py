import json
import math
import time as time_module
import requests
from django.urls import path
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt


# =============================================================================
# FMCSA HOURS OF SERVICE CONSTANTS
# Property-Carrying CMV Drivers | 70-Hour/8-Day | No Adverse Conditions
# Reference: 49 CFR Part 395
# =============================================================================

MAX_DRIVING_HOURS = 11.0       # §395.3(a)(3)(i)  — 11-Hour Driving Limit
MAX_DUTY_WINDOW = 14.0         # §395.3(a)(2)     — 14-Hour Driving Window
MAX_CYCLE_HOURS = 70.0         # §395.3(b)(2)     — 70-Hour/8-Day On-Duty Limit
CYCLE_DAYS = 8                 # Rolling 8 consecutive days
BREAK_AFTER_HOURS = 8.0        # §395.3(a)(3)(ii) — Must break after 8h driving
BREAK_DURATION = 0.5           # 30 minutes
FULL_REST_HOURS = 10.0         # §395.3(a)(1)     — 10 consecutive hours off
RESTART_HOURS = 34.0           # §395.3(c)(1)     — 34-Hour Restart
FUEL_INTERVAL_MILES = 1000.0   # Fuel stop every 1,000 miles
FUEL_STOP_HOURS = 0.5          # 30 minutes for fueling
PICKUP_HOURS = 1.0             # 1 hour for pickup/loading
DROPOFF_HOURS = 1.0            # 1 hour for drop-off/unloading

# Sleeper Berth Split Provision (§395.1(g))
# Allows splitting the 10-hour off-duty into two periods:
#   Period 1: >= 7 consecutive hours in the sleeper berth
#   Period 2: >= 2 hours off-duty or in sleeper berth (we use 3h → 7+3=10)
# Neither period counts against the 14-hour driving window.
SLEEPER_SPLIT_PRIMARY = 7.0
SLEEPER_SPLIT_COMPLEMENTARY = 3.0

# --------------------------------------------------------------------------
# FMCSA Duty Status Codes (per ELD Technical Specifications, §395.8)
# --------------------------------------------------------------------------
OFF_DUTY = "OFF"
SLEEPER_BERTH = "SB"
DRIVING = "D"
ON_DUTY_NOT_DRIVING = "ON"

STATUS_LABELS = {
    OFF_DUTY: "Off Duty",
    SLEEPER_BERTH: "Sleeper Berth",
    DRIVING: "Driving",
    ON_DUTY_NOT_DRIVING: "On Duty (Not Driving)",
}

# ELD Graph Grid Row Indices (the 4 rows of the 24-hour RODS graph)
GRAPH_ROWS = {
    OFF_DUTY: 0,
    SLEEPER_BERTH: 1,
    DRIVING: 2,
    ON_DUTY_NOT_DRIVING: 3,
}


# =============================================================================
# GEOCODING & ROUTING HELPERS
# =============================================================================

def get_coordinates(location_name):
    """
    Forward geocode a city/address name to 'longitude,latitude' string
    suitable for OSRM routing.

    Uses OpenStreetMap Nominatim (free, no API key required).
    """
    try:
        url = (
            f"https://nominatim.openstreetmap.org/search"
            f"?q={location_name}&format=json&limit=1"
        )
        headers = {'User-Agent': 'ELDRoutePlanner/1.0'}
        resp = requests.get(url, headers=headers, timeout=10).json()
        if resp:
            return f"{resp[0]['lon']},{resp[0]['lat']}"
    except Exception:
        pass
    return None


def get_route(coords_string):
    """
    Get driving route from OSRM (Open Source Routing Machine).

    Args:
        coords_string: Semicolon-separated "lon,lat" pairs, e.g.
                        "-87.6,41.8;-83.0,42.3;-84.3,33.7"

    Returns:
        Tuple of (total_miles, total_hours, geojson_geometry,
                  leg1_miles, leg1_hours, leg2_miles, leg2_hours)
        or (None, None, None, 0, 0, 0, 0) on failure.
    """
    try:
        url = (
            f"http://router.project-osrm.org/route/v1/driving/{coords_string}"
            f"?overview=full&geometries=geojson"
        )
        resp = requests.get(url, timeout=15).json()
        if resp.get('code') == 'Ok':
            route = resp['routes'][0]
            total_miles = route['distance'] * 0.000621371
            total_hours = route['duration'] / 3600
            geometry = route['geometry']
            legs = route['legs']

            l1_miles = legs[0]['distance'] * 0.000621371 if len(legs) > 0 else 0
            l1_hours = legs[0]['duration'] / 3600 if len(legs) > 0 else 0
            l2_miles = legs[1]['distance'] * 0.000621371 if len(legs) > 1 else 0
            l2_hours = legs[1]['duration'] / 3600 if len(legs) > 1 else 0

            return (total_miles, total_hours, geometry,
                    l1_miles, l1_hours, l2_miles, l2_hours)
    except Exception:
        pass
    return None, None, None, 0, 0, 0, 0


def haversine_miles(coord1, coord2):
    """
    Great-circle distance in miles between two [longitude, latitude] points.
    Uses the Haversine formula.
    """
    R = 3958.8  # Earth's mean radius in statute miles
    lon1, lat1 = math.radians(coord1[0]), math.radians(coord1[1])
    lon2, lat2 = math.radians(coord2[0]), math.radians(coord2[1])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2)
    return 2 * R * math.asin(math.sqrt(min(a, 1.0)))


def interpolate_route_position(geometry_coords, total_miles, miles_at_point):
    """
    Find the [lon, lat] position along a GeoJSON LineString at a given mileage.

    Uses the route geometry coordinates and proportional distance mapping.

    Args:
        geometry_coords: List of [lon, lat] coordinate pairs from OSRM.
        total_miles:     Total route distance in miles.
        miles_at_point:  Distance along the route to interpolate.

    Returns:
        [longitude, latitude] at the interpolated position.
    """
    if not geometry_coords or total_miles <= 0:
        return geometry_coords[0] if geometry_coords else [0, 0]

    fraction = max(0.0, min(miles_at_point / total_miles, 1.0))

    # Build cumulative distance along the geometry line
    cum = [0.0]
    for i in range(1, len(geometry_coords)):
        d = haversine_miles(geometry_coords[i - 1], geometry_coords[i])
        cum.append(cum[-1] + d)

    geom_total = cum[-1]
    if geom_total <= 0:
        return geometry_coords[0]

    target = fraction * geom_total

    # Find the segment containing the target distance and interpolate
    for i in range(1, len(cum)):
        if cum[i] >= target:
            seg_len = cum[i] - cum[i - 1]
            if seg_len <= 0:
                return list(geometry_coords[i])
            t = (target - cum[i - 1]) / seg_len
            lon = geometry_coords[i - 1][0] + t * (geometry_coords[i][0] - geometry_coords[i - 1][0])
            lat = geometry_coords[i - 1][1] + t * (geometry_coords[i][1] - geometry_coords[i - 1][1])
            return [round(lon, 6), round(lat, 6)]

    return list(geometry_coords[-1])


def reverse_geocode(lon, lat):
    """
    Reverse geocode [lon, lat] coordinates to a "City, State" string.

    Uses OpenStreetMap Nominatim with a city-level zoom for consistent
    results. Returns "Unknown" on failure.
    """
    try:
        url = (
            f"https://nominatim.openstreetmap.org/reverse"
            f"?lat={lat}&lon={lon}&format=json&zoom=10&addressdetails=1"
        )
        headers = {'User-Agent': 'ELDRoutePlanner/1.0'}
        resp = requests.get(url, headers=headers, timeout=5).json()
        addr = resp.get('address', {})
        city = (addr.get('city') or addr.get('town') or
                addr.get('village') or addr.get('hamlet') or
                addr.get('county', ''))
        state = addr.get('state', '')
        if city and state:
            return f"{city}, {state}"
        return city or state or "Unknown"
    except Exception:
        return "Unknown"


# =============================================================================
# HOS SIMULATOR — FMCSA-Compliant State Machine
# =============================================================================

class HosSimulator:
    """
    Simulates a complete trip under FMCSA Hours of Service regulations.

    The simulator processes a queue of trip tasks (driving legs, pickup,
    drop-off) and enforces all HOS constraints by injecting mandatory
    breaks, rest periods, fuel stops, and cycle restarts as needed.

    Output includes ELD-style logs with:
        - Per-entry timing data for 24-hour graph grid rendering
        - Cumulative HOS clock snapshots for compliance verification
        - Geographic location at each status change (for RODS remarks)
        - Per-day summaries with totals per duty status

    Implemented Regulations:
        §395.3(a)(1)     — 10-hour off-duty reset
        §395.3(a)(2)     — 14-hour driving window
        §395.3(a)(3)(i)  — 11-hour driving limit
        §395.3(a)(3)(ii) — 30-minute break after 8 hours of driving
        §395.3(b)(2)     — 70-hour/8-day on-duty limit (rolling)
        §395.3(c)(1)     — 34-hour restart provision
        §395.1(g)        — Sleeper berth split provision (7+3)
    """

    def __init__(self, cycle_hours_used, route_geometry_coords, total_route_miles):
        """
        Initialize the HOS simulator.

        Args:
            cycle_hours_used:      Total on-duty hours already used in the
                                   current 70-hour/8-day rolling cycle.
            route_geometry_coords: GeoJSON LineString coordinates [[lon,lat],...]
            total_route_miles:     Total route distance in miles.
        """
        # --- Absolute Elapsed Time (hours from trip start) ---
        self.elapsed = 0.0

        # --- Shift Clocks (reset by qualifying rest: 10h off or split pair) ---
        self.window_used = 0.0          # Wall-clock time since shift start (14h limit)
        self.driving_used = 0.0         # Actual driving in this shift     (11h limit)
        self.driving_since_break = 0.0  # Driving since last 30-min break  (8h limit)

        # --- 70-Hour/8-Day Rolling Cycle ---
        # Dictionary mapping day_index → on-duty hours for that day.
        # Day 0 = simulation day 1. Negative indices = prior days.
        # The rolling window sums the last CYCLE_DAYS (8) days.
        self.day_on_duty = {}
        self._init_cycle_history(cycle_hours_used)

        # --- Distance Tracking ---
        self.dist_since_fuel = 0.0      # Miles since last fuel stop
        self.total_miles_driven = 0.0   # Cumulative miles driven

        # --- Route Geometry (for location interpolation) ---
        self.route_coords = route_geometry_coords or []
        self.total_route_miles = total_route_miles or 0

        # --- Sleeper Berth Split State (§395.1(g)) ---
        self.split_pending = False  # True after first split, awaiting complementary

        # --- Output Accumulators ---
        self.raw_entries = []  # Log entries with absolute elapsed timestamps
        self.stops = []        # Key stops (fuel, rest, restart, pickup, dropoff)

    # -------------------------------------------------------------------------
    # Initialization Helpers
    # -------------------------------------------------------------------------

    def _init_cycle_history(self, hours_used):
        """
        Distribute previously-used cycle hours across the rolling 8-day window.

        In a production ELD, exact per-day history would be available.
        For trip planning, we distribute the reported total evenly across
        the prior 7 days. This is a conservative approximation: the hours
        won't "roll off" during short trips (< 8 days), which matches the
        worst-case scenario for planning purposes.
        """
        if hours_used <= 0:
            return
        distributable_days = min(7, CYCLE_DAYS - 1)
        per_day = hours_used / distributable_days
        for i in range(1, distributable_days + 1):
            self.day_on_duty[-i] = min(per_day, MAX_DUTY_WINDOW)

    # -------------------------------------------------------------------------
    # HOS Clock Properties
    # -------------------------------------------------------------------------

    @property
    def current_day_index(self):
        """Zero-based day index from simulation start."""
        return int(self.elapsed / 24)

    @property
    def hour_in_day(self):
        """Current hour within the day (0.0 – 24.0)."""
        return self.elapsed % 24

    @property
    def display_day(self):
        """Human-readable day number (1-based)."""
        return self.current_day_index + 1

    @property
    def cycle_hours_used(self):
        """Total on-duty hours in the rolling 8-day window."""
        current = self.current_day_index
        return sum(
            hours for day_idx, hours in self.day_on_duty.items()
            if day_idx > current - CYCLE_DAYS
        )

    @property
    def cycle_available(self):
        """Hours available in the 70-hour/8-day cycle."""
        return max(0.0, MAX_CYCLE_HOURS - self.cycle_hours_used)

    @property
    def window_available(self):
        """Hours remaining in the 14-hour driving window."""
        return max(0.0, MAX_DUTY_WINDOW - self.window_used)

    @property
    def driving_available(self):
        """Driving hours remaining in the 11-hour limit."""
        return max(0.0, MAX_DRIVING_HOURS - self.driving_used)

    @property
    def break_available(self):
        """Driving hours before a 30-minute break is mandatory."""
        return max(0.0, BREAK_AFTER_HOURS - self.driving_since_break)

    # -------------------------------------------------------------------------
    # Main Simulation Loop
    # -------------------------------------------------------------------------

    def simulate(self, tasks):
        """
        Run the HOS simulation over the trip task queue.

        Processes each task (drive, pickup, dropoff) while enforcing all
        FMCSA constraints. Mandatory breaks, rest periods, fuel stops, and
        cycle restarts are injected automatically when required.

        Args:
            tasks: List of task dicts:
                {
                    "is_driving": bool,       # True=driving, False=on-duty
                    "remaining_hours": float,  # Duration
                    "remaining_miles": float,  # Distance (driving only)
                    "description": str,        # Human-readable description
                }

        Returns:
            dict with 'logs', 'daily_logs', 'stops', 'total_days'
        """
        idx = 0
        iterations = 0
        max_iterations = 500  # Safety valve against infinite loops

        while idx < len(tasks) and iterations < max_iterations:
            iterations += 1
            task = tasks[idx]

            # Skip completed tasks
            if task['remaining_hours'] <= 0.001:
                idx += 1
                continue

            # --- Enforce HOS Constraints (may inject stops/rests) ---
            if self._enforce_constraints(task):
                continue  # Constraint was handled; re-evaluate from top

            # --- Execute the Task ---
            if task['is_driving']:
                self._execute_driving(task)
            else:
                self._execute_on_duty(task)

            # Advance to next task if this one is complete
            if task['remaining_hours'] <= 0.001:
                idx += 1

        return self._compile_output()

    # -------------------------------------------------------------------------
    # Constraint Enforcement (Priority-Ordered)
    # -------------------------------------------------------------------------

    def _enforce_constraints(self, task):
        """
        Check all HOS constraints in priority order and handle violations.

        Returns True if a constraint was handled (caller must re-check).
        Returns False if no constraints are violated and the task can proceed.

        Priority order:
            1. 70-Hour Cycle    → 34-Hour Restart
            2. 14-Hour Window   → Rest (full or sleeper split)
            3. 11-Hour Driving  → Rest (full or sleeper split)
            4. 8-Hour Break     → 30-Minute Break
            5. 1,000-Mile Fuel  → Fuel Stop
        """
        # ---- Priority 1: 70-Hour/8-Day Cycle Exhausted ----
        # §395.3(b)(2): No driving or on-duty work after 70 hours in 8 days.
        if self.cycle_available <= 0.01:
            self._do_restart()
            return True

        # For driving tasks, check driving-specific constraints
        if task['is_driving']:
            # ---- Priority 2: 14-Hour Driving Window Expired ----
            # §395.3(a)(2): Cannot DRIVE after 14 hours on-duty (can still
            # perform non-driving work). Wall-clock time from shift start.
            if self.window_available <= 0.01:
                self._do_rest(task)
                return True

            # ---- Priority 3: 11-Hour Driving Limit Reached ----
            # §395.3(a)(3)(i): Maximum 11 hours of driving within the
            # 14-hour window.
            if self.driving_available <= 0.01:
                self._do_rest(task)
                return True

            # ---- Priority 4: 30-Minute Break Required ----
            # §395.3(a)(3)(ii): After 8 cumulative hours of driving without
            # a 30-minute interruption, the driver must take a break.
            # Break can be off-duty, sleeper, or on-duty not driving.
            if self.break_available <= 0.01:
                self._do_mandatory_break()
                return True

            # ---- Priority 5: Fuel Stop Required ----
            # Business rule: fuel at least every 1,000 miles.
            if self.dist_since_fuel >= FUEL_INTERVAL_MILES:
                self._do_fuel_stop()
                return True

        return False

    # -------------------------------------------------------------------------
    # Task Execution
    # -------------------------------------------------------------------------

    def _execute_driving(self, task):
        """
        Drive as far as possible within the tightest HOS constraint.

        Calculates the bottleneck across all active limits (cycle, window,
        driving, break, fuel distance) and executes that amount.
        """
        # Average speed for proportional distance calculation
        speed = (task['remaining_miles'] / task['remaining_hours']
                 if task['remaining_hours'] > 0.001 else 60.0)

        # Time until fuel stop is needed
        dist_to_fuel = FUEL_INTERVAL_MILES - self.dist_since_fuel
        time_to_fuel = dist_to_fuel / speed if speed > 0 else 999.0

        # Find the strict bottleneck — the minimum of ALL constraints
        driveable = min(
            self.cycle_available,      # 70-hour cycle
            self.window_available,     # 14-hour window
            self.driving_available,    # 11-hour driving
            self.break_available,      # 8-hour break
            time_to_fuel,              # 1,000-mile fuel
            task['remaining_hours']    # Remaining task time
        )

        if driveable <= 0.001:
            return

        miles = driveable * speed
        location = self._get_current_location()

        self._add_entry(
            status=DRIVING,
            detail=task['description'],
            hours=driveable,
            miles=miles,
            location=location,
        )

        # Update all clocks
        self._advance_clocks(driveable, is_driving=True)
        self.dist_since_fuel += miles
        self.total_miles_driven += miles

        # Consume from task
        task['remaining_hours'] -= driveable
        task['remaining_miles'] -= miles

    def _execute_on_duty(self, task):
        """
        Execute on-duty (not driving) work.

        Per §395.3(a)(2), on-duty work CAN continue past the 14-hour
        driving window — only DRIVING is prohibited. However, on-duty
        time still counts toward the 70-hour/8-day cycle.

        On Duty (Not Driving) includes: loading/unloading, fueling,
        vehicle inspection, paperwork, waiting for dispatch, drug testing,
        and yard moves (§395.8(j)(3)).
        """
        doable = min(self.cycle_available, task['remaining_hours'])

        if doable <= 0.001:
            return

        location = self._get_current_location()

        self._add_entry(
            status=ON_DUTY_NOT_DRIVING,
            detail=task['description'],
            hours=doable,
            miles=0,
            location=location,
        )

        # On-duty: counts toward window AND cycle (but NOT driving limit)
        self._advance_clocks(doable, is_driving=False, is_on_duty=True)

        # §395.3(a)(3)(ii) — 2020 Rule: any on-duty-not-driving period
        # of >= 30 minutes satisfies the 30-minute break requirement.
        # This includes fueling, loading, or any other non-driving work.
        if doable >= BREAK_DURATION:
            self.driving_since_break = 0.0

        task['remaining_hours'] -= doable

    # -------------------------------------------------------------------------
    # Mandatory Stops & Rest Periods
    # -------------------------------------------------------------------------

    def _do_mandatory_break(self):
        """
        30-minute off-duty break after 8 hours of accumulated driving.
        §395.3(a)(3)(ii)

        The break is logged as Off Duty. It advances the 14-hour window
        (wall-clock time within the shift) but does NOT count toward the
        70-hour cycle (off-duty time is excluded from on-duty totals).
        """
        location = self._get_current_location()
        self._add_entry(
            OFF_DUTY,
            "30-Minute Rest Break",
            BREAK_DURATION, 0, location,
        )
        self.stops.append({
            "type": "rest_break",
            "hours": BREAK_DURATION,
            "location": location,
            "day": self.display_day,
        })

        # Off-duty: advances wall-clock (window) but NOT cycle
        self.elapsed += BREAK_DURATION
        self.window_used += BREAK_DURATION
        self.driving_since_break = 0.0

    def _do_rest(self, current_task=None):
        """
        Qualifying rest period: full 10-hour off-duty OR sleeper berth split.

        Strategy: The simulator uses the Split Sleeper Berth Provision
        (§395.1(g)) when all of the following conditions are met:
            1. The driver hit the 14-hour window (not the 11-hour limit)
            2. The driver still has > 1 hour of driving capacity
            3. There is > 3 hours of driving remaining in the trip
            4. No split is already pending

        Otherwise, a standard 10-hour off-duty rest is used.
        """
        # If a split is already pending, complete it with the complementary period
        if self.split_pending:
            self._do_split_complementary()
            return

        # Determine remaining trip driving time for strategy decision
        remaining_trip_driving = 0
        if current_task and current_task['is_driving']:
            remaining_trip_driving = current_task['remaining_hours']

        # Evaluate split sleeper berth strategy
        # Use split ONLY when the 14-hr window expired but driving hours remain
        # This maximizes efficiency by not "wasting" unused driving hours
        can_split = (
            self.window_available <= 0.01 and      # 14-hr window is the bottleneck
            self.driving_available > 1.0 and        # Significant driving capacity left
            remaining_trip_driving > 3.0             # Enough trip left to justify
        )

        if can_split:
            self._do_split_primary()
        else:
            self._do_full_rest()

    def _do_full_rest(self):
        """
        Standard 10-hour consecutive off-duty rest period.
        §395.3(a)(1)

        Resets all shift-level clocks: 14-hour window, 11-hour driving,
        and 8-hour break. Does NOT count toward the 70-hour cycle.
        """
        location = self._get_current_location()
        self._add_entry(
            OFF_DUTY,
            "10-Hour Off-Duty Rest",
            FULL_REST_HOURS, 0, location,
        )
        self.stops.append({
            "type": "rest",
            "hours": FULL_REST_HOURS,
            "location": location,
            "day": self.display_day,
        })

        # Advance elapsed only (off-duty → no cycle impact)
        self.elapsed += FULL_REST_HOURS

        # Full shift reset
        self.window_used = 0.0
        self.driving_used = 0.0
        self.driving_since_break = 0.0
        self.split_pending = False

    def _do_split_primary(self):
        """
        Sleeper Berth Split — Period 1 of 2: 7 hours in sleeper berth.
        §395.1(g)

        This is the first half of the split sleeper berth provision.
        The 14-hour window is PAUSED (not consumed) during this period.
        Upon waking, the driver resumes with a fresh 14-hour window but
        their 11-hour driving usage is preserved.

        The driver must later take a complementary rest period (3 hours)
        to complete the pair. After both periods, all clocks fully reset.

        Key distinction from full rest:
            - Full rest: resets EVERYTHING (window + driving + break)
            - Split primary: resets WINDOW only (driving preserved)
        """
        location = self._get_current_location()
        self._add_entry(
            SLEEPER_BERTH,
            "Sleeper Berth — Split Rest 1/2 (7h)",
            SLEEPER_SPLIT_PRIMARY, 0, location,
        )
        self.stops.append({
            "type": "sleeper_split_1",
            "hours": SLEEPER_SPLIT_PRIMARY,
            "location": location,
            "day": self.display_day,
        })

        # Advance elapsed but NOT cycle (sleeper berth is not on-duty)
        self.elapsed += SLEEPER_SPLIT_PRIMARY

        # §395.1(g): The 14-hour window is recalculated EXCLUDING this period.
        # Effect: driver gets a fresh 14-hour window.
        # The 11-hour driving usage is preserved until both splits complete.
        self.window_used = 0.0
        self.driving_since_break = 0.0
        self.split_pending = True

    def _do_split_complementary(self):
        """
        Sleeper Berth Split — Period 2 of 2: 3 hours in sleeper berth.
        §395.1(g)

        Completes the split pair. Combined with the primary period,
        the driver has accumulated 7+3 = 10 hours of qualifying rest.
        All shift clocks are now fully reset, equivalent to a standard
        10-hour off-duty period.
        """
        location = self._get_current_location()
        self._add_entry(
            SLEEPER_BERTH,
            "Sleeper Berth — Split Rest 2/2 (3h)",
            SLEEPER_SPLIT_COMPLEMENTARY, 0, location,
        )
        self.stops.append({
            "type": "sleeper_split_2",
            "hours": SLEEPER_SPLIT_COMPLEMENTARY,
            "location": location,
            "day": self.display_day,
        })

        # Advance elapsed but NOT cycle (sleeper berth)
        self.elapsed += SLEEPER_SPLIT_COMPLEMENTARY

        # Both split periods complete → full shift reset
        self.window_used = 0.0
        self.driving_used = 0.0
        self.driving_since_break = 0.0
        self.split_pending = False

    def _do_restart(self):
        """
        34-Hour Restart: resets the 70-hour/8-day rolling cycle to zero.
        §395.3(c)(1)

        The driver must spend 34 consecutive hours off-duty (or in sleeper
        berth) to reset the cycle. This is used when the rolling 70-hour
        total is exhausted.

        Effect: Clears ALL accumulated on-duty hours from the 8-day window,
        giving the driver a full 70-hour cycle, plus resets all shift clocks.
        """
        location = self._get_current_location()
        self._add_entry(
            OFF_DUTY,
            "34-Hour Restart",
            RESTART_HOURS, 0, location,
        )
        self.stops.append({
            "type": "restart",
            "hours": RESTART_HOURS,
            "location": location,
            "day": self.display_day,
        })

        # Advance elapsed (off-duty → no cycle impact)
        self.elapsed += RESTART_HOURS

        # Complete reset: cycle, shift, and split state
        self.day_on_duty.clear()
        self.window_used = 0.0
        self.driving_used = 0.0
        self.driving_since_break = 0.0
        self.split_pending = False

    def _do_fuel_stop(self):
        """
        Fueling stop: 30 minutes on-duty (not driving).

        Fueling is classified as On Duty (Not Driving) per §395.2 and
        counts toward both the 14-hour window and the 70-hour cycle.

        Since the duration (30 min) meets the §395.3(a)(3)(ii) threshold,
        this also satisfies the mandatory 30-minute break requirement.
        """
        location = self._get_current_location()
        self._add_entry(
            ON_DUTY_NOT_DRIVING,
            "Fueling Stop",
            FUEL_STOP_HOURS, 0, location,
        )
        self.stops.append({
            "type": "fuel",
            "hours": FUEL_STOP_HOURS,
            "location": location,
            "day": self.display_day,
        })

        # On-duty: counts toward window AND cycle
        self._advance_clocks(FUEL_STOP_HOURS, is_driving=False, is_on_duty=True)
        self.dist_since_fuel = 0.0

        # Fueling >= 30 min qualifies as the mandatory break
        self.driving_since_break = 0.0

    # -------------------------------------------------------------------------
    # Clock Management
    # -------------------------------------------------------------------------

    def _advance_clocks(self, hours, is_driving=False, is_on_duty=False):
        """
        Advance all relevant HOS clocks for an activity period.

        The 14-hour driving window is a WALL-CLOCK timer: it advances for
        ALL activities within a shift (driving, on-duty, and even short
        off-duty periods). Only a qualifying 10-hour rest resets it.

        The 70-hour/8-day cycle counts only ON-DUTY time (driving + on-duty
        not driving). Off-duty and sleeper berth time are excluded.

        On-duty hours are assigned to the correct day index for proper
        rolling-window calculation (hours are split at day boundaries).
        """
        # Shift-level clocks
        self.window_used += hours

        if is_driving:
            self.driving_used += hours
            self.driving_since_break += hours

        # Cycle-level: assign on-duty hours to correct day(s)
        if is_driving or is_on_duty:
            remaining = hours
            temp_elapsed = self.elapsed
            while remaining > 0.001:
                day_idx = int(temp_elapsed / 24)
                hours_left_in_day = 24.0 - (temp_elapsed % 24)
                chunk = min(remaining, hours_left_in_day)
                self.day_on_duty[day_idx] = self.day_on_duty.get(day_idx, 0) + chunk
                temp_elapsed += chunk
                remaining -= chunk

        # Advance absolute time
        self.elapsed += hours

    # -------------------------------------------------------------------------
    # Location Interpolation
    # -------------------------------------------------------------------------

    def _get_current_location(self):
        """
        Get the approximate geographic position at the current mileage.

        Interpolates along the route geometry to find the [lon, lat]
        corresponding to the total miles driven so far.
        """
        if not self.route_coords:
            return {"lon": 0, "lat": 0}
        coord = interpolate_route_position(
            self.route_coords, self.total_route_miles, self.total_miles_driven
        )
        return {"lon": coord[0], "lat": coord[1]}

    # -------------------------------------------------------------------------
    # Log Entry Creation
    # -------------------------------------------------------------------------

    def _add_entry(self, status, detail, hours, miles, location):
        """
        Create a structured log entry with absolute elapsed timestamps.

        Day assignment and day-boundary splitting are deferred to
        post-processing (_split_at_day_boundaries) for correctness.

        Clock snapshots capture the state BEFORE this entry's time is
        applied, representing the driver's clocks at the start of
        this activity.
        """
        self.raw_entries.append({
            "_start_elapsed": self.elapsed,
            "_end_elapsed": self.elapsed + hours,
            "_total_hours": hours,
            "_total_miles": miles,
            "status_code": status,
            "status_label": STATUS_LABELS[status],
            "status_detail": detail,
            "graph_row": GRAPH_ROWS[status],
            "location": location,
            "clocks": {
                "driving_used": round(self.driving_used, 2),
                "driving_available": round(self.driving_available, 2),
                "window_used": round(self.window_used, 2),
                "window_available": round(self.window_available, 2),
                "cycle_used": round(self.cycle_hours_used, 2),
                "cycle_available": round(self.cycle_available, 2),
                "driving_since_break": round(self.driving_since_break, 2),
                "break_available": round(self.break_available, 2),
            },
        })

    # -------------------------------------------------------------------------
    # Output Compilation & Post-Processing
    # -------------------------------------------------------------------------

    def _compile_output(self):
        """
        Post-process raw entries into the final ELD-ready output:
            1. Split entries at 24-hour day boundaries (for graph grid)
            2. Compute day-local start_hour / end_hour
            3. Compile per-day RODS summaries
            4. Reverse geocode key stop locations
        """
        processed = self._split_at_day_boundaries()
        daily_logs = self._compile_daily_summaries(processed)
        self._geocode_stops()

        total_days = max((e['day'] for e in processed), default=1) if processed else 1

        return {
            "logs": processed,
            "daily_logs": daily_logs,
            "stops": self.stops,
            "total_days": total_days,
        }

    def _split_at_day_boundaries(self):
        """
        Split log entries at 24-hour day boundaries for ELD graph grid.

        The ELD RODS graph grid (§395.8) displays a 24-hour period with
        4 rows (Off Duty, Sleeper Berth, Driving, On Duty Not Driving).
        Each entry must be contained within a single day, so entries that
        span midnight are split into two (or more) day-bounded segments.

        Each output entry includes:
            - day: 1-based day number
            - start_hour: start position within the day (0.0-24.0)
            - end_hour: end position within the day (0.0-24.0)
        """
        processed = []

        for entry in self.raw_entries:
            start = entry['_start_elapsed']
            end = entry['_end_elapsed']
            total_h = entry['_total_hours']
            total_m = entry['_total_miles']

            if total_h <= 0.001:
                continue

            current = start
            while current < end - 0.001:
                day_idx = int(current / 24)
                next_boundary = (day_idx + 1) * 24.0
                chunk_end = min(end, next_boundary)
                chunk_hours = chunk_end - current

                if chunk_hours <= 0.001:
                    current = chunk_end
                    continue

                # Proportionally split miles for driving entries
                chunk_miles = (
                    total_m * chunk_hours / total_h
                    if total_h > 0 and total_m > 0 else 0
                )

                end_hour_val = chunk_end % 24
                if end_hour_val < 0.001 and chunk_hours > 0.001:
                    end_hour_val = 24.0

                processed.append({
                    "day": day_idx + 1,
                    "status": entry['status_detail'],       # Backward-compat
                    "status_code": entry['status_code'],     # FMCSA code
                    "status_label": entry['status_label'],   # FMCSA label
                    "status_detail": entry['status_detail'], # Full description
                    "hours": round(chunk_hours, 2),
                    "miles": round(chunk_miles, 2),
                    "start_hour": round(current % 24, 2),
                    "end_hour": round(end_hour_val, 2),
                    "graph_row": entry['graph_row'],
                    "location": entry['location'],
                    "clocks": entry['clocks'],
                    "remark": entry['status_detail'],
                })

                current = chunk_end

        return processed

    def _compile_daily_summaries(self, processed_entries):
        """
        Compile per-day RODS (Record of Duty Status) summaries.

        Each day's summary includes:
            - Total hours per duty status (must sum to logged time)
            - Total miles driven
            - All log entries for that day (for graph grid rendering)

        This matches the FMCSA requirement (§395.8(b)) that each 24-hour
        period's RODS must capture total hours in each status.
        """
        days = {}
        for entry in processed_entries:
            d = entry['day']
            if d not in days:
                days[d] = {
                    "day": d,
                    "total_off_duty": 0.0,
                    "total_sleeper_berth": 0.0,
                    "total_driving": 0.0,
                    "total_on_duty_not_driving": 0.0,
                    "total_miles": 0.0,
                    "entries": [],
                }

            summary = days[d]
            summary['entries'].append(entry)
            summary['total_miles'] += entry['miles']

            status = entry['status_code']
            if status == OFF_DUTY:
                summary['total_off_duty'] += entry['hours']
            elif status == SLEEPER_BERTH:
                summary['total_sleeper_berth'] += entry['hours']
            elif status == DRIVING:
                summary['total_driving'] += entry['hours']
            elif status == ON_DUTY_NOT_DRIVING:
                summary['total_on_duty_not_driving'] += entry['hours']

        # Round all totals
        for d in days.values():
            for key in ('total_off_duty', 'total_sleeper_berth',
                        'total_driving', 'total_on_duty_not_driving',
                        'total_miles'):
                d[key] = round(d[key], 2)

        return days

    def _geocode_stops(self):
        """
        Reverse geocode stop locations to add city/state names.

        Adds a 'location_name' field (e.g., "Springfield, IL") to each
        stop for use as RODS remarks (§395.8(d): location of each change
        of duty status must be recorded).

        Rate-limited to respect Nominatim's usage policy (1 req/sec).
        """
        for stop in self.stops:
            loc = stop.get('location', {})
            lon, lat = loc.get('lon', 0), loc.get('lat', 0)
            if lon and lat:
                stop['location_name'] = reverse_geocode(lon, lat)
                time_module.sleep(0.35)  # Respect Nominatim rate limit
            else:
                stop['location_name'] = "Unknown"


# =============================================================================
# API VIEW FUNCTIONS
# =============================================================================

def test_api(request):
    """Health check endpoint — confirms backend connectivity."""
    return JsonResponse({
        "message": "Success! The Django backend is talking to React."
    })


@csrf_exempt
def plan_trip(request):
    """
    Main trip planning endpoint.

    Accepts a POST request with origin, pickup, and drop-off locations
    plus current cycle usage. Returns an FMCSA-compliant trip plan with:
        - Route geometry (GeoJSON) for map rendering
        - HOS-compliant daily logs with ELD graph grid data
        - Per-day RODS summaries
        - Stop locations (fuel, rest, pickup, drop-off)
        - Trip summary statistics

    Request Body (JSON):
        {
            "currentLocation": "Chicago, IL",
            "pickupLocation":  "Detroit, MI",
            "dropoffLocation": "Atlanta, GA",
            "cycleUsed":       10.0
        }

    Response (JSON):
        {
            "status": "success",
            "message": "Trip planned: 850.3 miles, ~13.2 hrs driving, 2 day(s)",
            "total_distance_miles": 850.3,
            "total_drive_hours": 13.2,
            "estimated_days": 2,
            "logs": [...],          # Flat list of all log entries
            "daily_logs": {...},    # Per-day RODS summaries
            "stops": [...],         # Stop locations with reverse-geocoded names
            "route_geometry": {...} # GeoJSON for map rendering
        }
    """
    if request.method != 'POST':
        return JsonResponse({"error": "Only POST allowed"}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON in request body."}, status=400)

    # --- Extract & Validate Inputs ---
    cycle_used = float(data.get('cycleUsed', 0))
    current_loc = data.get('currentLocation', '').strip()
    pickup_loc = data.get('pickupLocation', '').strip()
    dropoff_loc = data.get('dropoffLocation', '').strip()

    if not all([current_loc, pickup_loc, dropoff_loc]):
        return JsonResponse(
            {"error": "All three locations (current, pickup, dropoff) are required."},
            status=400,
        )
    if not (0 <= cycle_used <= MAX_CYCLE_HOURS):
        return JsonResponse(
            {"error": f"Cycle hours must be between 0 and {MAX_CYCLE_HOURS}."},
            status=400,
        )

    # --- Forward Geocode Locations ---
    curr_coords = get_coordinates(current_loc)
    pick_coords = get_coordinates(pickup_loc)
    drop_coords = get_coordinates(dropoff_loc)

    if not all([curr_coords, pick_coords, drop_coords]):
        failed = []
        if not curr_coords:
            failed.append(f"current location '{current_loc}'")
        if not pick_coords:
            failed.append(f"pickup location '{pickup_loc}'")
        if not drop_coords:
            failed.append(f"dropoff location '{dropoff_loc}'")
        return JsonResponse(
            {"error": f"Could not geocode: {', '.join(failed)}"},
            status=400,
        )

    # --- Get Route from OSRM ---
    route_str = f"{curr_coords};{pick_coords};{drop_coords}"
    total_miles, total_hours, geometry, l1_miles, l1_hours, l2_miles, l2_hours = (
        get_route(route_str)
    )

    if total_miles is None:
        return JsonResponse(
            {"error": "Could not calculate route between the given locations."},
            status=400,
        )

    # --- Build Trip Task Queue ---
    # The queue represents the driver's ordered activities:
    #   1. Deadhead drive from current location to pickup
    #   2. On-duty loading at pickup (1 hour)
    #   3. Loaded drive from pickup to drop-off
    #   4. On-duty unloading at drop-off (1 hour)
    tasks = [
        {
            "is_driving": True,
            "remaining_hours": l1_hours,
            "remaining_miles": l1_miles,
            "description": "Driving — Deadhead to Pickup",
        },
        {
            "is_driving": False,
            "remaining_hours": PICKUP_HOURS,
            "remaining_miles": 0,
            "description": "On Duty — Loading at Pickup",
        },
        {
            "is_driving": True,
            "remaining_hours": l2_hours,
            "remaining_miles": l2_miles,
            "description": "Driving — Loaded to Drop-off",
        },
        {
            "is_driving": False,
            "remaining_hours": DROPOFF_HOURS,
            "remaining_miles": 0,
            "description": "On Duty — Unloading at Drop-off",
        },
    ]

    # --- Run HOS Simulation ---
    route_coords = geometry.get('coordinates', []) if geometry else []
    simulator = HosSimulator(cycle_used, route_coords, total_miles)
    result = simulator.simulate(tasks)

    return JsonResponse({
        "status": "success",
        "message": (
            f"Trip planned: {round(total_miles, 1)} miles, "
            f"~{round(total_hours, 1)} hrs driving, "
            f"{result['total_days']} day(s)"
        ),
        "total_distance_miles": round(total_miles, 2),
        "total_drive_hours": round(total_hours, 2),
        "estimated_days": result['total_days'],
        "logs": result['logs'],
        "daily_logs": result['daily_logs'],
        "stops": result['stops'],
        "route_geometry": geometry,
    })


@csrf_exempt
def hos_status(request):
    """
    HOS Clock Status endpoint — returns current availability for all clocks.

    Useful for dashboard widgets showing the driver's remaining hours.

    Request Body (JSON):
        {
            "cycleUsed": 35.0,
            "shiftDriving": 5.0,
            "shiftOnDuty": 7.5,
            "drivingSinceBreak": 3.0
        }

    Response (JSON):
        {
            "status": "success",
            "clocks": {
                "driving": { "used", "available", "limit", "label", "regulation" },
                "window":  { ... },
                "break":   { ... },
                "cycle":   { ... }
            }
        }
    """
    if request.method != 'POST':
        return JsonResponse({"error": "Only POST allowed"}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON in request body."}, status=400)

    cycle_used = float(data.get('cycleUsed', 0))
    shift_driving = float(data.get('shiftDriving', 0))
    shift_on_duty = float(data.get('shiftOnDuty', 0))
    since_break = float(data.get('drivingSinceBreak', 0))

    return JsonResponse({
        "status": "success",
        "clocks": {
            "driving": {
                "used": round(shift_driving, 2),
                "available": round(max(0, MAX_DRIVING_HOURS - shift_driving), 2),
                "limit": MAX_DRIVING_HOURS,
                "label": "11-Hour Driving Limit",
                "regulation": "§395.3(a)(3)(i)",
            },
            "window": {
                "used": round(shift_on_duty, 2),
                "available": round(max(0, MAX_DUTY_WINDOW - shift_on_duty), 2),
                "limit": MAX_DUTY_WINDOW,
                "label": "14-Hour Driving Window",
                "regulation": "§395.3(a)(2)",
            },
            "break": {
                "used": round(since_break, 2),
                "available": round(max(0, BREAK_AFTER_HOURS - since_break), 2),
                "limit": BREAK_AFTER_HOURS,
                "label": "30-Minute Break Required After",
                "regulation": "§395.3(a)(3)(ii)",
            },
            "cycle": {
                "used": round(cycle_used, 2),
                "available": round(max(0, MAX_CYCLE_HOURS - cycle_used), 2),
                "limit": MAX_CYCLE_HOURS,
                "label": "70-Hour/8-Day On-Duty Limit",
                "regulation": "§395.3(b)(2)",
            },
        },
    })


# =============================================================================
# URL CONFIGURATION
# =============================================================================

urlpatterns = [
    path('api/test/', test_api),
    path('api/plan-trip/', plan_trip),
    path('api/hos-status/', hos_status),
]