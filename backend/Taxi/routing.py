from django.urls import re_path
from .consumers import RideRequestConsumer, RideNotificationConsumer

websocket_urlpatterns = [
    re_path(r"ws/rides/$", RideRequestConsumer.as_asgi()),
    re_path("ws/notifications/", RideNotificationConsumer.as_asgi()),
]
