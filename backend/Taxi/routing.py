from django.urls import re_path
from Taxi.consumers import RideRequestConsumer, RideNotificationConsumer

websocket_urlpatterns = [
    # re_path(r"ws/rides/$", RideRequestConsumer.as_asgi()),
    re_path(r"ws/notifications/user_(?P<user_id>[^/]+)/$", RideNotificationConsumer.as_asgi()),
]
