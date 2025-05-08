import json
from channels.generic.websocket import AsyncWebsocketConsumer
from django.contrib.auth import get_user_model
from channels.db import database_sync_to_async
from rest_framework_simplejwt.tokens import AccessToken


class RideRequestConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        """Handles WebSocket connection."""
        await self.accept()

    async def disconnect(self, close_code):
        """Handles WebSocket disconnection."""
        pass

    async def receive(self, text_data):
        """Handles incoming messages from the WebSocket."""
        data = json.loads(text_data)
        action = data.get("action")

        if action == "new_ride":
            # Broadcast ride request to all connected drivers
            await self.channel_layer.group_send(
                "drivers",
                {
                    "type": "ride_request",
                    "ride_id": data.get("ride_id"),
                    "pickup_location": data.get("pickup_location"),
                    "destination": data.get("destination"),
                }
            )

    async def ride_request(self, event):
        """Sends ride request details to all drivers."""
        await self.send(text_data=json.dumps(event))



from django.contrib.auth import get_user_model

User = get_user_model()

@database_sync_to_async
def get_user_from_token(token):
    try:
        # Verify and decode the JWT token
        access_token = AccessToken(token)
        print(f"this is the access_token: {access_token}")
        user_id = access_token['id']
        user = User.objects.get(id=user_id)
        # if not user.is_active:
        #     raise Exception("User is inactive")
        return user
    except Exception as e:
        print(f"Invalid JWT token: {e}")
        return None
class RideNotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        """Connect authenticated users to WebSocket using JWT."""
        self.url_user_id = self.scope["url_route"]["kwargs"]["user_id"]
        # print(f"Attempting connection for user_id: {self.url_user_id}")
       
        # Extract token from query string
        query_string = self.scope["query_string"].decode()
        token = None
        for param in query_string.split("&"):
            if param.startswith("token="):
                token = param.split("=")[1]

        if not token:
            print("WebSocket rejected: No token provided")
            await self.close(code=4001)
            return
        # Authenticate user with JWT token
        self.user = await get_user_from_token(token)
        if not self.user or not self.user.is_authenticated:
            print("WebSocket rejected: Invalid or expired token plus one error below")
            print(f"WebSocket rejected: Invalid or expired token for user_id {self.url_user_id}")
            await self.close(code=4001)
            # await self.close(code=4001)
            return
        # Verify URL user_id matches authenticated user
        if str(self.user.id) != self.url_user_id:
            print(f"WebSocket rejected: URL user_id {self.url_user_id} does not match authenticated user {self.user.id}")
            await self.close(code=4003)
            return
        self.group_name = f"user_{self.user.id}"
        try:
            await self.channel_layer.group_add(self.group_name, self.channel_name)
            await self.accept()
            # print(f"WebSocket connected for user {self.user.id}")
        except Exception as e:
            print(f"Error connecting WebSocket for user {self.user.id}: {e}")
            await self.close(code=4004)
        
    async def disconnect(self, close_code):
        """Remove user from notification group on disconnect."""
        if hasattr(self, 'group_name'):
            try:
                await self.channel_layer.group_discard(self.group_name, self.channel_name)
                print(f"WebSocket disconnected for user {self.user.id}, code: {close_code}")
            except Exception as e:
                print(f"Error disconnecting WebSocket for user {self.user.id}: {e}")
        

    async def send_notification(self, event):
        """Send real-time notification to user with carpoolride_id."""
        try:
            message = event.get("message")
            carpoolride_id = event.get("carpoolride_id")  # Include carpoolride_id if provided
            if not message:
                print(f"Empty message received for user {self.user.id}")
                return

            payload = {"message": message}
            if carpoolride_id:
                payload["carpoolride_id"] = carpoolride_id

            await self.send(text_data=json.dumps({
                "type": "send_notification",
                "message": message,
                "carpoolride_id": carpoolride_id,
            }))
            print(f"Notification sent to user {self.user.id}: {payload}")
        except Exception as e:
            print(f"Error sending notification to user {self.user.id}: {e}")

# import json
# from channels.generic.websocket import AsyncWebsocketConsumer

# class RideNotificationConsumer(AsyncWebsocketConsumer):
#     async def connect(self):
#         """Connect only authenticated users to WebSocket."""
#         self.user = self.scope["user"]
#         if self.user.is_authenticated:
#             self.group_name = f"user_{self.user.id}"
#             await self.channel_layer.group_add(self.group_name, self.channel_name)
#             await self.accept()
#         else:
#             await self.close()

#     async def disconnect(self, close_code):
#         """Remove user from notification group on disconnect."""
#         if self.user.is_authenticated:
#             await self.channel_layer.group_discard(self.group_name, self.channel_name)

#     async def send_notification(self, event):
#         """Send real-time notification to user."""
#         await self.send(text_data=json.dumps({"message": event["message"]}))
