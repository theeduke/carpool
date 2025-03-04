import json
from channels.generic.websocket import AsyncWebsocketConsumer

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



import json
from channels.generic.websocket import AsyncWebsocketConsumer

class RideNotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        """Connect only authenticated users to WebSocket."""
        self.user = self.scope["user"]
        if self.user.is_authenticated:
            self.group_name = f"user_{self.user.id}"
            await self.channel_layer.group_add(self.group_name, self.channel_name)
            await self.accept()
        else:
            await self.close()

    async def disconnect(self, close_code):
        """Remove user from notification group on disconnect."""
        if self.user.is_authenticated:
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def send_notification(self, event):
        """Send real-time notification to user."""
        await self.send(text_data=json.dumps({"message": event["message"]}))
