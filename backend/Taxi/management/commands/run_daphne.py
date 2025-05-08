# Taxi/management/commands/run_daphne.py
from django.core.management.base import BaseCommand
from daphne.server import Server
from carpoolBackend.asgi import application

class Command(BaseCommand):
    help = "Runs the Daphne ASGI server"

    def add_arguments(self, parser):
        parser.add_argument("--host", default="0.0.0.0", help="Host to bind")
        parser.add_argument("--port", default=8001, type=int, help="Port to bind")

    def handle(self, *args, **options):
        host = options["host"]
        port = options["port"]
        self.stdout.write(f"Starting Daphne server on {host}:{port}")
        Server(application=application, endpoints=[f"tcp:port={port}:interface={host}"]).run()