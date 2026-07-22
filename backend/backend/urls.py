import json
import math
import time as time_module
import requests
from django.urls import path
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt

MAX_DRIVING_HOURS = 11.0
MAX_DUTY_WINDOW = 14.0
MAX_CYCLE_HOURS = 70.0
CYCLE_DAYS = 8                 # Rolling 8 consecutive days
BREAK_AFTER_HOURS = 8.0
BREAK_DURATION = 0.5           # 30 minutes
FULL_REST_HOURS = 10.0
RESTART_HOURS = 34.0
FUEL_INTERVAL_MILES = 1000.0   # Fuel stop every 1,000 miles
FUEL_STOP_HOURS = 0.5          # 30 minutes for fueling
PICKUP_HOURS = 1.0             # 1 hour for pickup/loading
DROPOFF_HOURS = 1.0            # 1 hour for drop-off/unloading

# Sleeper Berth Split Provision
SLEEPER_SPLIT_PRIMARY = 7.0
SLEEPER_SPLIT_COMPLEMENTARY = 3.0

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

GRAPH_ROWS = {
    OFF_DUTY: 0,
    SLEEPER_BERTH: 1,
    DRIVING: 2,
    ON_DUTY_NOT_DRIVING: 3,
}

def get_coordinates(location_name):
    
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
    
    R = 3958.8
    lon1, lat1 = math.radians(coord1[0]), math.radians(coord1[1])
    lon2, lat2 = math.radians(coord2[0]), math.radians(coord2[1])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2)
    return 2 * R * math.asin(math.sqrt(min(a, 1.0)))

def interpolate_route_position(geometry_coords, total_miles, miles_at_point):
    
    if not geometry_coords or total_miles <= 0:
        return geometry_coords[0] if geometry_coords else [0, 0]

    fraction = max(0.0, min(miles_at_point / total_miles, 1.0))

    cum = [0.0]
    for i in range(1, len(geometry_coords)):
        d = haversine_miles(geometry_coords[i - 1], geometry_coords[i])
        cum.append(cum[-1] + d)

    geom_total = cum[-1]
    if geom_total <= 0:
        return geometry_coords[0]

    target = fraction * geom_total

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

class HosSimulator:
    
    def __init__(self, cycle_hours_used, route_geometry_coords, total_route_miles):
        
        self.elapsed = 0.0

        self.window_used = 0.0
        self.driving_used = 0.0
        self.driving_since_break = 0.0

        # --- 70-Hour/8-Day Rolling Cycle ---
        self.day_on_duty = {}
        self._init_cycle_history(cycle_hours_used)

        # --- Distance Tracking ---
        self.dist_since_fuel = 0.0      # Miles since last fuel stop
        self.total_miles_driven = 0.0   # Cumulative miles driven

        self.route_coords = route_geometry_coords or []
        self.total_route_miles = total_route_miles or 0

        self.split_pending = False

        # --- Output Accumulators ---
        self.raw_entries = []
        self.stops = []

    # Initialization Helpers

    def _init_cycle_history(self, hours_used):
        
        if hours_used <= 0:
            return
        distributable_days = min(7, CYCLE_DAYS - 1)
        per_day = hours_used / distributable_days
        for i in range(1, distributable_days + 1):
            self.day_on_duty[-i] = min(per_day, MAX_DUTY_WINDOW)

    # HOS Clock Properties

    @property
    def current_day_index(self):
        
        return int(self.elapsed / 24)

    @property
    def hour_in_day(self):
        
        return self.elapsed % 24

    @property
    def display_day(self):
        
        return self.current_day_index + 1

    @property
    def cycle_hours_used(self):
        
        current = self.current_day_index
        return sum(
            hours for day_idx, hours in self.day_on_duty.items()
            if day_idx > current - CYCLE_DAYS
        )

    @property
    def cycle_available(self):
        
        return max(0.0, MAX_CYCLE_HOURS - self.cycle_hours_used)

    @property
    def window_available(self):
        
        return max(0.0, MAX_DUTY_WINDOW - self.window_used)

    @property
    def driving_available(self):
        
        return max(0.0, MAX_DRIVING_HOURS - self.driving_used)

    @property
    def break_available(self):
        
        return max(0.0, BREAK_AFTER_HOURS - self.driving_since_break)

    # Main Simulation Loop

    def simulate(self, tasks):
        
        idx = 0
        iterations = 0
        max_iterations = 500

        while idx < len(tasks) and iterations < max_iterations:
            iterations += 1
            task = tasks[idx]

            # Skip completed tasks
            if task['remaining_hours'] <= 0.001:
                idx += 1
                continue

            if self._enforce_constraints(task):
                continue

            # --- Execute the Task ---
            if task['is_driving']:
                self._execute_driving(task)
            else:
                self._execute_on_duty(task)

            # Advance to next task if this one is complete
            if task['remaining_hours'] <= 0.001:
                idx += 1

        return self._compile_output()

    # Constraint Enforcement (Priority-Ordered)

    def _enforce_constraints(self, task):
        
        if self.cycle_available <= 0.01:
            self._do_restart()
            return True

        if task['is_driving']:
            if self.window_available <= 0.01:
                self._do_rest(task)
                return True

            if self.driving_available <= 0.01:
                self._do_rest(task)
                return True

            if self.break_available <= 0.01:
                self._do_mandatory_break()
                return True

            if self.dist_since_fuel >= FUEL_INTERVAL_MILES:
                self._do_fuel_stop()
                return True

        return False

    # Task Execution

    def _execute_driving(self, task):
        
        speed = (task['remaining_miles'] / task['remaining_hours']
                 if task['remaining_hours'] > 0.001 else 60.0)

        # Time until fuel stop is needed
        dist_to_fuel = FUEL_INTERVAL_MILES - self.dist_since_fuel
        time_to_fuel = dist_to_fuel / speed if speed > 0 else 999.0

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

        self._advance_clocks(doable, is_driving=False, is_on_duty=True)

        if doable >= BREAK_DURATION:
            self.driving_since_break = 0.0

        task['remaining_hours'] -= doable

    # Mandatory Stops & Rest Periods

    def _do_mandatory_break(self):
        
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

        self.elapsed += BREAK_DURATION
        self.window_used += BREAK_DURATION
        self.driving_since_break = 0.0

    def _do_rest(self, current_task=None):
        
        if self.split_pending:
            self._do_split_complementary()
            return

        remaining_trip_driving = 0
        if current_task and current_task['is_driving']:
            remaining_trip_driving = current_task['remaining_hours']

        # Evaluate split sleeper berth strategy
        can_split = (
            self.window_available <= 0.01 and      # 14-hr window is the bottleneck
            self.driving_available > 1.0 and
            remaining_trip_driving > 3.0             # Enough trip left to justify
        )

        if can_split:
            self._do_split_primary()
        else:
            self._do_full_rest()

    def _do_full_rest(self):
        
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

        self.elapsed += FULL_REST_HOURS

        # Full shift reset
        self.window_used = 0.0
        self.driving_used = 0.0
        self.driving_since_break = 0.0
        self.split_pending = False

    def _do_split_primary(self):
        
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

        self.elapsed += SLEEPER_SPLIT_PRIMARY

        self.window_used = 0.0
        self.driving_since_break = 0.0
        self.split_pending = True

    def _do_split_complementary(self):
        
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

        self.driving_since_break = 0.0

    # Clock Management

    def _advance_clocks(self, hours, is_driving=False, is_on_duty=False):
        
        # Shift-level clocks
        self.window_used += hours

        if is_driving:
            self.driving_used += hours
            self.driving_since_break += hours

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

    # Location Interpolation

    def _get_current_location(self):
        
        if not self.route_coords:
            return {"lon": 0, "lat": 0}
        coord = interpolate_route_position(
            self.route_coords, self.total_route_miles, self.total_miles_driven
        )
        return {"lon": coord[0], "lat": coord[1]}

    # Log Entry Creation

    def _add_entry(self, status, detail, hours, miles, location):
        
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

    # Output Compilation & Post-Processing

    def _compile_output(self):
        
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
        
        for stop in self.stops:
            loc = stop.get('location', {})
            lon, lat = loc.get('lon', 0), loc.get('lat', 0)
            if lon and lat:
                stop['location_name'] = reverse_geocode(lon, lat)
                time_module.sleep(0.35)  # Respect Nominatim rate limit
            else:
                stop['location_name'] = "Unknown"

def test_api(request):
    
    return JsonResponse({
        "message": "Success! The Django backend is talking to React."
    })

@csrf_exempt
def plan_trip(request):
    
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

# urlpatterns moved to bottom
from django.contrib.auth import authenticate, login as django_login, logout as django_logout
from django.contrib.auth.models import User

@csrf_exempt
def auth_register(request):
    if request.method != 'POST':
        return JsonResponse({"error": "Only POST allowed"}, status=405)
    try:
        data = json.loads(request.body)
        email = data.get('email', '').strip()
        password = data.get('password', '')
        
        if not email or not password:
            return JsonResponse({"error": "Email and password required"}, status=400)
            
        if User.objects.filter(username=email).exists():
            return JsonResponse({"error": "User with this email already exists"}, status=400)
            
        user = User.objects.create_user(username=email, email=email, password=password)
        user.first_name = email.split('@')[0]
        user.save()
        
        # Log them in automatically
        django_login(request, user)
        return JsonResponse({"status": "success", "user": {"email": user.email, "name": user.first_name}})
        
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

@csrf_exempt
def auth_login(request):
    if request.method != 'POST':
        return JsonResponse({"error": "Only POST allowed"}, status=405)
    try:
        data = json.loads(request.body)
        email = data.get('email', '').strip()
        password = data.get('password', '')
        
        user = authenticate(request, username=email, password=password)
        if user is not None:
            django_login(request, user)
            return JsonResponse({"status": "success", "user": {"email": user.email, "name": user.first_name}})
        else:
            return JsonResponse({"error": "Invalid credentials"}, status=401)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

@csrf_exempt
def auth_logout(request):
    if request.method == 'POST':
        django_logout(request)
        return JsonResponse({"status": "success"})
    return JsonResponse({"error": "Only POST allowed"}, status=405)

@csrf_exempt
def auth_forgot_password(request):
    if request.method == 'POST':
        # Mock success for forgot password
        return JsonResponse({"status": "success", "message": "If an account exists, a reset link has been sent."})
    return JsonResponse({"error": "Only POST allowed"}, status=405)

@csrf_exempt
def auth_me(request):
    if request.user.is_authenticated:
        return JsonResponse({
            "status": "success", 
            "user": {
                "email": request.user.email,
                "name": request.user.first_name
            }
        })
    return JsonResponse({"status": "unauthenticated"}, status=401)

def health_check(request):
    return HttpResponse("API is running", status=200)

urlpatterns = [
    path('', health_check, name='health_check'),
    path('api/test/', test_api),
    path('api/plan-trip/', plan_trip),
    path('api/hos-status/', hos_status),
    path('api/auth/register/', auth_register),
    path('api/auth/login/', auth_login),
    path('api/auth/logout/', auth_logout),
    path('api/auth/forgot-password/', auth_forgot_password),
    path('api/auth/me/', auth_me),
]
