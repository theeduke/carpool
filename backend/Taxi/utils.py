import requests
from django.conf import settings

def verify_national_id(national_id):
    #cheks the Kenya National Population Registry.
    """
    Function to validate National ID using the eCitizen API.
    """
    ECITIZEN_API_URL = "https://ecitizen.go.ke/api/validate_id"
    API_KEY = settings.ECITIZEN_API_KEY  # Store API key in env variables

    response = requests.post(
        ECITIZEN_API_URL,
        json={"national_id": national_id},
        headers={"Authorization": f"Bearer {API_KEY}"}
    )

    if response.status_code == 200:
        data = response.json()
        return data.get("valid", False)  # True if ID is valid
    else:
        return False


from .models import NTSAVerificationLog, CustomUser
from django.utils.timezone import now, timedelta

def verify_driving_license(request):
    """
    Function to validate Driving License using NTSA TIMS API.
    """
    NTSA_API_URL = "https://tims.ntsa.go.ke/api/validate_license"
    API_KEY = settings.NTSA_API_KEY  # Store API key in env variables

    user = request.user  # Get the authenticated user
    # if user.is_blocked:
    #     return {"error": "Your verification attempts are blocked. Contact admin."}
    
     # Check if the user is in cooldown mode
    if user.cooldown_until and user.cooldown_until > now():
        remaining_time = (user.cooldown_until - now()).total_seconds() // 60
        return {"error": f"Too many failed attempts. Try again in {remaining_time} minutes."}
    
    if not user.driving_license_number:
        return {"error": "No driving license number found for this user."}
    
     # Count failed attempts in the last hour
    one_hour_ago = now() - timedelta(hours=1)
    failed_attempts = NTSAVerificationLog.objects.filter(
        user=user, status="failed", timestamp__gte=one_hour_ago
    ).count()

    if failed_attempts >= 3:
        # Set cooldown for 3 hours
        user.cooldown_until = now() + timedelta(hours=3)
        user.save()
        return {"error": "Too many failed attempts. Try again after 3 hours."}
    
    #  # Check failed attempts in the last 24 hours
    # twenty_four_hours_ago = now() - timedelta(hours=24)
    # failed_attempts = NTSAVerificationLog.objects.filter(
    #     user=user, status="failed", timestamp__gte=twenty_four_hours_ago
    # ).count()

    # if failed_attempts >= 3:
    #     return {"error": "Too many failed attempts. Try again after 24 hours."}

    
    response = requests.post(
        NTSA_API_URL,
        json={"license_number": user.driving_license_number},
        headers={"Authorization": f"Bearer {API_KEY}"}
    )

    # if response.status_code == 200:
    #     data = response.json()
    #     return data.get("valid", False)  # True if license is valid
    # else:
    #     return False
    
     # Log the verification attempt
    log_entry = NTSAVerificationLog.objects.create(
        user=user,
        driving_license_number=user.driving_license_number,
        status="success" if response.status_code == 200 and response.json().get("valid", False) else "failed",
        response_data=response.json() if response.status_code == 200 else None,
    )

    return log_entry.status == "success"



 #to send websocket messages
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from .firebase import send_push_notification # for firebase cloud messaging

def send_notification(user_id, message):
    """Send a real-time WebSocket notification to a specific user."""
    channel_layer = get_channel_layer()
    group_name = f"user_{user_id}"

    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            "type": "send_notification",
            "message": message,
        },
    )

def notify_user(user, message):
    """Send a notification via WebSockets and Firebase."""
    send_notification(user.id, message)  # WebSocket
    send_push_notification(user, message)  # Firebase