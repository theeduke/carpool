from django.urls import re_path
from Taxi.consumers import RideRequestConsumer, RideNotificationConsumer, ChatConsumer
websocket_urlpatterns = [
    re_path(r"ws/notifications/user_(?P<user_id>[^/]+)/$", RideNotificationConsumer.as_asgi()),
    re_path(r"ws/ride_requests/ride_(?P<ride_id>[^/]+)/$", RideRequestConsumer.as_asgi()),
    re_path(r'ws/chat/(?P<carpoolride_id>[^/]+)/$', ChatConsumer.as_asgi()),
    
]
