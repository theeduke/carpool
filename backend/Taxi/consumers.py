import json
from channels.generic.websocket import AsyncWebsocketConsumer
from django.contrib.auth import get_user_model
from channels.db import database_sync_to_async
from rest_framework_simplejwt.tokens import AccessToken
from datetime import datetime
from Taxi.models import Message, CarpoolRide, RideRequest
from django.core.exceptions import ObjectDoesNotExist
import uuid

import logging

logger = logging.getLogger(__name__)

User = get_user_model()

@database_sync_to_async
def get_user_from_token(token):
    try:
        access_token = AccessToken(token)
        logger.info(f"Access token payload: {access_token}")
        user_id = access_token['id']
        user = User.objects.get(id=user_id)
        logger.info(f"User found: {user.id}, is_active: {user.is_active}")
        return user
    except Exception as e:
        logger.error(f"Invalid JWT token: {str(e)}")
        return None

@database_sync_to_async
def save_message(sender, recipient, carpoolride_id, content):
    try:
        ride = CarpoolRide.objects.get(carpoolride_id=carpoolride_id)
        message = Message.objects.create(
            sender=sender,
            recipient=recipient,
            ride=ride,
            content=content,
            timestamp=datetime.now(),
            status='sent'
        )
        logger.info(f"Message saved: ID={message.message_id}, Status={message.status}")
        return message
    except Exception as e:
        logger.error(f"Error saving message: {str(e)}")
        return None

@database_sync_to_async
def update_message_status(message_id, status):
    try:
        # message = Message.objects.get(message_id=message_id)
        message = Message.objects.select_related('sender').get(message_id=message_id)
        message.status = status
        message.save()
        logger.info(f"Message {message_id} updated to status: {status}")
        return message
    except Exception as e:
        logger.error(f"Error updating message status: {e}")
        return None

@database_sync_to_async
def is_user_in_ride(user, carpoolride_id):
    try:
        ride = CarpoolRide.objects.get(carpoolride_id=carpoolride_id)
        is_driver = ride.driver == user
        is_passenger = RideRequest.objects.filter(
            ride=ride,
            passenger=user,
            status='accepted'
        ).exists()
        logger.info(f"User {user.id} in ride {carpoolride_id}: is_driver={is_driver}, is_passenger={is_passenger}")
        return is_driver or is_passenger
    except CarpoolRide.DoesNotExist:
        logger.error(f"Ride {carpoolride_id} does not exist")
        return False

# consumer for notifications
class RideNotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.url_user_id = self.scope["url_route"]["kwargs"]["user_id"]
        query_string = self.scope["query_string"].decode()
        token = None
        for param in query_string.split("&"):
            if param.startswith("token="):
                token = param.split("=")[1]

        if not token:
            logger.error(f"WebSocket rejected: No token provided for user_id {self.url_user_id}")
            await self.close(code=4001)
            return

        self.user = await get_user_from_token(token)
        if not self.user or not self.user.is_authenticated:
            logger.error(f"WebSocket rejected: Invalid or expired token for user_id {self.url_user_id}")
            await self.close(code=4001)
            return

        if str(self.user.id) != self.url_user_id:
            logger.error(f"WebSocket rejected: URL user_id {self.url_user_id} does not match authenticated user {self.user.id}")
            await self.close(code=4003)
            return

        self.group_name = f"user_{self.user.id}"
        try:
            await self.channel_layer.group_add(self.group_name, self.channel_name)
            await self.accept()
            logger.info(f"WebSocket connected for notifications: user {self.user.id}")
        except Exception as e:
            logger.error(f"Error connecting WebSocket for user {self.user.id}: {e}")
            await self.close(code=4004)

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            try:
                await self.channel_layer.group_discard(self.group_name, self.channel_name)
                logger.info(f"WebSocket disconnected for user {self.user.id}, code: {close_code}")
            except Exception as e:
                logger.error(f"Error disconnecting WebSocket for user {self.user.id}: {e}")

    async def send_notification(self, event):
        try:
            message = event.get("message")
            notification_id = event.get("notification_id")
            carpoolride_id = event.get("carpoolride_id")
            logger.info(f"Received event for user {self.user.id}: {event}")
            if not message:
                logger.warning(f"Empty message received for user {self.user.id}")
                return

            payload = {"message": message}
            if carpoolride_id:
                payload["carpoolride_id"] = carpoolride_id

            await self.send(text_data=json.dumps({
                "type": event["type"],
                # "type": "send_notification",
                "user_id": event.get("user_id"),  # Add this
                "message": message,
                "carpoolride_id": carpoolride_id,
                "notification_id": notification_id,
            }))
            logger.info(f"Notification sent to user {self.user.id}: {payload}")
        except Exception as e:
            logger.error(f"Error sending notification to user {self.user.id}: {e}")
    
    async def notification_dismissed(self, event):
        try:
            notification_id = event.get("notification_id")
            logger.info(f"Notification dismissed for user {self.user.id}: {notification_id}")
            await self.send(text_data=json.dumps({
                "type": "notification_dismissed",
                "user_id": event.get("user_id"),
                "notification_id": notification_id,
                "message": event.get("message"),
            }))
        except Exception as e:
            logger.error(f"Error sending dismissal to user {self.user.id}: {e}")


# consumer for chats
class ChatConsumer(AsyncWebsocketConsumer):
    active_connections = {}  # Format: {(user_id, carpoolride_id): channel_name}

    async def connect(self):
        self.carpoolride_id = self.scope["url_route"]["kwargs"]["carpoolride_id"]
        query_string = self.scope["query_string"].decode()
        token = None
        for param in query_string.split("&"):
            if param.startswith("token="):
                token = param.split("=")[1]

        if not token:
            logger.error(f"WebSocket rejected: No token provided for ride {self.carpoolride_id}")
            await self.send(text_data=json.dumps({
                "type": "error",
                "message": "No token provided"
            }))
            await self.close(code=4001)
            return

        self.user = await get_user_from_token(token)
        if not self.user or not self.user.is_authenticated:
            logger.error(f"WebSocket rejected: Invalid or expired token for ride {self.carpoolride_id}")
            await self.send(text_data=json.dumps({
                "type": "error",
                "message": "Invalid or expired token"
            }))
            await self.close(code=4001)
            return

        if not await is_user_in_ride(self.user, self.carpoolride_id):
            logger.error(f"WebSocket rejected: User {self.user.id} not authorized for ride {self.carpoolride_id}")
            await self.send(text_data=json.dumps({
                "type": "error",
                "message": "You are not authorized for this ride"
            }))
            await self.close(code=4003)
            return

        self.group_name = f"chat_{self.carpoolride_id}"
        connection_key = (str(self.user.id), self.carpoolride_id)
        logger.info(f"Attempting WebSocket connection for user {self.user.id} in ride {self.carpoolride_id}")

        try:
            # Accept the connection
            await self.accept()
            logger.info(f"WebSocket accepted for user {self.user.id} in ride {self.carpoolride_id}")

            # Join the group before closing existing connection
            await self.channel_layer.group_add(self.group_name, self.channel_name)
            logger.info(f"User {self.user.id} joined group {self.group_name}")

            # Close existing connection if it exists
            if connection_key in self.active_connections:
                existing_channel = self.active_connections[connection_key]
                if existing_channel != self.channel_name:
                    logger.info(f"Closing existing connection for user {self.user.id} in ride {self.carpoolride_id}, channel {existing_channel}")
                    await self.channel_layer.send(
                        existing_channel,
                        {"type": "close.connection", "message": "New connection established"}
                    )

            # Update active_connections
            self.active_connections[connection_key] = self.channel_name
            logger.info(f"WebSocket fully connected for user {self.user.id} in ride {self.carpoolride_id}, active_connections: {list(self.active_connections.keys())}")
            messages_to_broadcast = await self.mark_messages_delivered()
            for event in messages_to_broadcast:
                await self.channel_layer.group_send(self.group_name, event)
        except Exception as e:
            logger.error(f"Error connecting WebSocket for user {self.user.id} in ride {self.carpoolride_id}: {e}")
            await self.send(text_data=json.dumps({
                "type": "error",
                "message": "Failed to connect to chat"
            }))
            await self.close(code=4004)

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            try:
                await self.channel_layer.group_discard(self.group_name, self.channel_name)
                connection_key = (str(self.user.id), self.carpoolride_id)
                if connection_key in self.active_connections and self.active_connections[connection_key] == self.channel_name:
                    del self.active_connections[connection_key]
                    logger.info(f"Removed connection for user {self.user.id} in ride {self.carpoolride_id} from active_connections")
                logger.info(f"WebSocket disconnected for user {self.user.id} in ride {self.carpoolride_id}, code: {close_code}, active_connections: {list(self.active_connections.keys())}")
            except Exception as e:
                logger.error(f"Error disconnecting WebSocket for user {self.user.id}: {e}")

    async def close_connection(self, event):
        logger.info(f"Closing connection for user {self.user.id} in ride {self.carpoolride_id}: {event['message']}")
        await self.send(text_data=json.dumps({
            "type": "error",
            "message": event["message"]
        }))
        await self.close(code=4005)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            action = data.get("action")
            logger.info(f"Received data from user {self.user.id}: {data}")

            if action == "send_message":
                content = data.get("content")
                recipient_id = data.get("recipient_id")
                carpoolride_id = data.get("carpoolride_id")

                if not content or not recipient_id or not carpoolride_id:
                    logger.error(f"Invalid message data from user {self.user.id}: content={content}, recipient_id={recipient_id}, carpoolride_id={carpoolride_id}")
                    await self.send(text_data=json.dumps({
                        "type": "error",
                        "message": "Invalid message data: content, recipient_id, or carpoolride_id missing"
                    }))
                    return

                try:
                    recipient = await database_sync_to_async(User.objects.get)(id=recipient_id)
                except User.DoesNotExist:
                    logger.error(f"Recipient {recipient_id} not found for message from user {self.user.id}")
                    await self.send(text_data=json.dumps({
                        "type": "error",
                        "message": "Recipient not found"
                    }))
                    return

                message = await save_message(self.user, recipient, carpoolride_id, content)
                if not message:
                    logger.error(f"Failed to save message for user {self.user.id}")
                    await self.send(text_data=json.dumps({
                        "type": "error",
                        "message": "Failed to save message"
                    }))
                    return

                await self.channel_layer.group_send(
                    self.group_name,
                    {
                        "type": "chat_message",
                        "message_id": str(message.message_id),
                        "sender_id": str(self.user.id),
                        "recipient_id": str(recipient.id),
                        "content": content,
                        "timestamp": message.timestamp.isoformat(),
                        "status": message.status,
                    }
                )
                # Send unread count update to recipient
                recipient_group = f"user_{recipient_id}"
                unread_count = await self.get_unread_count(recipient, carpoolride_id, self.user)
                await self.channel_layer.group_send(
                    recipient_group,
                    {
                        "type": "unread_count",
                        "carpoolride_id": str(carpoolride_id),
                        "sender_id": str(self.user.id),
                        "unread_count": unread_count,
                    }
                )

            elif action == "typing":
                await self.channel_layer.group_send(
                    self.group_name,
                    {
                        "type": "typing",
                        "user_id": str(self.user.id),
                    }
                )

            elif action == "mark_seen":
                message_id = data.get("message_id")
                message = await update_message_status(message_id, 'seen')
                if message:
                    await self.channel_layer.group_send(
                        self.group_name,
                        {
                            "type": "message_status",
                            "message_id": str(message.message_id),
                            "status": 'seen',
                        }
                    )
                    # Send unread count update to recipient
                    recipient_group = f"user_{self.user.id}"
                    unread_count = await self.get_unread_count(self.user, self.carpoolride_id, message.sender)
                    await self.channel_layer.group_send(
                        recipient_group,
                        {
                            "type": "unread_count",
                            "carpoolride_id": self.carpoolride_id,
                            "sender_id": str(message.sender.id),
                            "unread_count": unread_count,
                        }
                    )
                    

        except json.JSONDecodeError:
            logger.error(f"Invalid JSON data from user {self.user.id}: {text_data}")
            await self.send(text_data=json.dumps({
                "type": "error",
                "message": "Invalid JSON data"
            }))

    async def chat_message(self, event):
        if event['sender_id'] != str(self.user.id):
            message = await update_message_status(event['message_id'], 'delivered')
            if message:
                await self.channel_layer.group_send(
                    self.group_name,
                    {
                        "type": "message_status",
                        "message_id": str(message.message_id),
                        "status": 'delivered',
                    }
                )

        await self.send(text_data=json.dumps({
            "type": "chat_message",
            "message_id": event["message_id"],
            "sender_id": event["sender_id"],
            "recipient_id": event["recipient_id"],
            "content": event["content"],
            "timestamp": event["timestamp"],
            "status": event["status"],
        }))

    async def message_status(self, event):
        await self.send(text_data=json.dumps({
            "type": "message_status",
            "message_id": event["message_id"],
            "status": event["status"],
        }))

    async def typing(self, event):
        await self.send(text_data=json.dumps({
            "type": "typing",
            "user_id": event["user_id"],
        }))

    @database_sync_to_async
    def mark_messages_delivered(self):
        try:
            messages = Message.objects.filter(
                ride__carpoolride_id=self.carpoolride_id,
                recipient=self.user,
                status='sent'
            )
            events = []
            for message in messages:
                message.status = 'delivered'
                message.save()
                events.append({
                    "type": "message_status",
                    "message_id": str(message.message_id),
                    "status": "delivered",
                })
            logger.info(f"Marked {len(events)} messages as delivered for user {self.user.id} in ride {self.carpoolride_id}")
            return events
        except Exception as e:
            logger.error(f"Error marking messages delivered: {e}")
            return []
    @database_sync_to_async
    def get_unread_count(self, recipient, carpoolride_id, sender):
        try:
            unread_count = Message.objects.filter(
                ride__carpoolride_id=carpoolride_id,
                recipient=recipient,
                sender=sender,
                status__in=['sent', 'delivered']
            ).count()
            logger.info(f"Unread count for user {recipient.id} in ride {carpoolride_id} from sender {sender.id}: {unread_count}")
            return unread_count
        except Exception as e:
            logger.error(f"Error fetching unread count for user {recipient.id} in ride {carpoolride_id}: {e}")
            return 0
            

# consumer for ride requests
class RideRequestConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.ride_id = self.scope["url_route"]["kwargs"]["ride_id"]
        query_string = self.scope["query_string"].decode()
        token = None
        for param in query_string.split("&"):
            if param.startswith("token="):
                token = param.split("=")[1]

        if not token:
            logger.error(f"WebSocket rejected: No token provided for ride {self.ride_id}")
            await self.close(code=4001)
            return

        self.user = await get_user_from_token(token)
        if not self.user or not self.user.is_authenticated:
            logger.error(f"WebSocket rejected: Invalid or expired token for ride {self.ride_id}")
            await self.close(code=4001)
            return

        # Check if user is the driver of this ride
        try:
            ride = await database_sync_to_async(CarpoolRide.objects.get)(carpoolride_id=self.ride_id)
            # Access ride.driver in a thread-safe way
            driver = await database_sync_to_async(lambda: ride.driver)()
            if driver != self.user:
                logger.error(f"WebSocket rejected: User {self.user.id} is not the driver of ride {self.ride_id}")
                await self.close(code=4003)
                return
        except ObjectDoesNotExist:
            logger.error(f"WebSocket rejected: Ride {self.ride_id} does not exist")
            await self.close(code=4003)
            return

        self.group_name = f"ride_{self.ride_id}"
        try:
            await self.channel_layer.group_add(self.group_name, self.channel_name)
            await self.accept()
            logger.info(f"WebSocket connected for ride requests: user {self.user.id}, ride {self.ride_id}")
        except Exception as e:
            logger.error(f"Error connecting WebSocket for user {self.user.id}, ride {self.ride_id}: {e}")
            await self.close(code=4004)

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            try:
                await self.channel_layer.group_discard(self.group_name, self.channel_name)
                logger.info(f"WebSocket disconnected for user {self.user.id}, ride {self.ride_id}, code: {close_code}")
            except Exception as e:
                logger.error(f"Error disconnecting WebSocket for user {self.user.id}, ride {self.ride_id}: {e}")

    async def ride_request_update(self, event):
        try:
            request_data = event.get("request_data")
            if not request_data:
                logger.warning(f"Empty ride request data received for user {self.user.id}, ride {self.ride_id}")
                return

            await self.send(text_data=json.dumps({
                "type": "ride_request_update",
                "request_data": request_data,
            }))
            logger.info(f"Ride request update sent to user {self.user.id}, ride {self.ride_id}: {request_data}")
        except Exception as e:
            logger.error(f"Error sending ride request update to user {self.user.id}, ride {self.ride_id}: {e}")


# class RideConsumer(AsyncWebsocketConsumer):
#     async def connect(self):
#         # Extract carpoolride_id from the URL
#         self.carpoolride_id = self.scope['url_route']['kwargs']['carpoolride_id']
#         self.ride_group_name = f'ride_{self.carpoolride_id}'

#         # Extract token from query string
#         query_string = self.scope['query_string'].decode()
#         token = None
#         for param in query_string.split('&'):
#             if param.startswith('token='):
#                 token = param.split('=')[1]

#         if not token:
#             logger.error(f"WebSocket rejected: No token provided for ride {self.carpoolride_id}")
#             await self.close(code=4001)
#             return

#         # Authenticate the user using the token
#         self.user = await get_user_from_token(token)
#         if not self.user or not self.user.is_authenticated:
#             logger.error(f"WebSocket rejected: Invalid or expired token for ride {self.carpoolride_id}")
#             await self.close(code=4001)
#             return

#         # Check if the user is the driver of the ride
#         if not await self.is_driver():
#             logger.error(f"WebSocket rejected: User {self.user.id} is not the driver of ride {self.carpoolride_id}")
#             await self.close(code=4003)
#             return

#         # Add the driver to the ride-specific group
#         try:
#             await self.channel_layer.group_add(self.ride_group_name, self.channel_name)
#             await self.accept()
#             logger.info(f"WebSocket connected for driver {self.user.id} on ride {self.carpoolride_id}")
#         except Exception as e:
#             logger.error(f"Error connecting WebSocket for driver {self.user.id} on ride {self.carpoolride_id}: {e}")
#             await self.close(code=4004)

#     async def disconnect(self, close_code):
#         # Remove the driver from the group on disconnect
#         if hasattr(self, 'ride_group_name'):
#             try:
#                 await self.channel_layer.group_discard(self.ride_group_name, self.channel_name)
#                 logger.info(f"WebSocket disconnected for driver {self.user.id} on ride {self.carpoolride_id}, code: {close_code}")
#             except Exception as e:
#                 logger.error(f"Error disconnecting WebSocket for driver {self.user.id}: {e}")

#     async def receive(self, text_data):
#         # Optionally handle messages from the client (not needed for now)
#         pass

#     # Method to send new ride request updates to the driver
#     async def ride_request_update(self, event):
#         request_data = event['request_data']
#         try:
#             await self.send(text_data=json.dumps({
#                 'type': 'ride_request_update',
#                 'request': request_data,
#             }))
#             logger.info(f"Sent ride request update to driver {self.user.id} for ride {self.carpoolride_id}: {request_data}")
#         except Exception as e:
#             logger.error(f"Error sending ride request update to driver {self.user.id}: {e}")

#     @database_sync_to_async
#     def is_driver(self):
#         try:
#             ride = CarpoolRide.objects.get(carpoolride_id=self.carpoolride_id)
#             return ride.driver == self.user
#         except CarpoolRide.DoesNotExist:
#             logger.error(f"Ride {self.carpoolride_id} does not exist")
#             return False
