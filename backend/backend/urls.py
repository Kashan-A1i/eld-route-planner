from django.urls import path
from django.http import JsonResponse

# This is your very first backend function!
def test_api(request):
    return JsonResponse({
        "message": "Success! The Django backend is talking to React.",
        "status": "ready"
    })

urlpatterns = [
    path('api/test/', test_api),
]