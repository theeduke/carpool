from django.urls import path, include
import uuid
from rest_framework.routers import DefaultRouter

from .views import( SubmitDisputeView, ResolveDisputeView, AllDisputesView,UserDisputeListView, DisputeRideView,
 DriverDashboardView,
    DriverRideRequestsView,
    DriverRegisterView,
    UpdateCarpoolRideView,
    UploadIDImageView,
    UploadSmartDLView,
    WalletBalanceView,
    PayoutRequestView,
    DriverAvailabilityView,
    OptimizeRouteView,
    SendNotificationView,
    # ApproveRideRequestView,
    AcceptRideRequestView,
    RejectRideRequestView,
    DeclineRideRequestView,
    CreateCarpoolRideView,
    RideHistoryView,
    UpdateDriverLocationView,
    # GetDriverLocationView,
    start_ride,
    StartRideView,
    CompleteRideView,
    AdminResetCooldownView,
    ResolveDisputeView,
    UserDashboardView,
    PassengerDriverLocationView,
    RequestToJoinRideView,
    CancelRideView,
    # GetDriverLiveLocationView,
    DriverLocationView,
    GetMapKeyView,
    google_maps_tile,
    
    # DepositToWalletView,
    PayForRideWithWalletView,
    ReleaseRidePaymentToDriverView,
    WithdrawToMpesaView,
    SubmitDisputeView,
    UserDisputeListView,
    TransferFundsView,
    MockWalletController,
    # MpesaCallbackView,
    WalletTopUpCallbackView,
    
    RegisterView,LoginView, google_login, VerifyEmail, PasswordResetRequestView, PasswordResetView, LogoutView,
    CustomTokenRefreshView, UserProfileView, UpdateFCMTokenView,
    
    CarpoolRideViewSet, PassengerCarpoolRideViewSet,
    VehicleMakeListView, VehicleModelListView
)


router = DefaultRouter()
router.register(r'driver/rides', CarpoolRideViewSet, basename='driver-rides')  # for drivers
router.register(r'passenger/available-rides', PassengerCarpoolRideViewSet, basename='passenger-rides')  #for passengers
router.register(r"wallet/mock", MockWalletController, basename="mock-wallet")



urlpatterns = [
        #rides
    path('', include(router.urls)),
    # vehicles
    path('vehicle-makes/', VehicleMakeListView.as_view(), name='vehicle-makes'),
    path('vehicle-models/', VehicleModelListView.as_view(), name='vehicle-models'),
    
    # disputes
    path("dispute/submit/", SubmitDisputeView.as_view(), name="submit_dispute"),
    path("dispute/<uuid:dispute_id>/resolve/", ResolveDisputeView.as_view(), name="resolve_dispute"),
    path("dispute/my-disputes/", UserDisputeListView.as_view(), name="user_disputes"),
    path("api/dispute-ride/<uuid:ride_id>/", DisputeRideView.as_view(), name="dispute-ride"),
    
    #driver
    path("register/driver/", DriverRegisterView.as_view(), name="driver-register"),
    path("driver/dashboard/", DriverDashboardView.as_view(), name="driver-dashboard"),
    path("driver/ride-requests", DriverRideRequestsView.as_view(), name="driver ride requests"),
    path("driver/upload-id/", UploadIDImageView.as_view(), name="upload-id"),
    path("driver/upload-smart-dl/", UploadSmartDLView.as_view(), name="upload-smart-dl"),
    path("driver/wallet/", WalletBalanceView.as_view(), name="wallet-balance"),
    path("driver/payout/", PayoutRequestView.as_view(), name="payout-request"),
    path("driver/availability/", DriverAvailabilityView.as_view(), name="driver-availability"),
    path("driver/ride-request/approve/<uuid:pk>/", AcceptRideRequestView.as_view(), name="approve-ride-request"),
    path("driver/ride-request/decline/<uuid:pk>/", DeclineRideRequestView.as_view(), name="reject-ride-request"),
    path("driver/create-ride/", CreateCarpoolRideView.as_view(), name="create-carpool-ride"),
    path("driver/update-location/", UpdateDriverLocationView.as_view(), name="update-driver-location"),
    # path("passenger/driver-location/<uuid:ride_id>/", GetDriverLocationView.as_view(), name="get-driver-location"),
    path("driver/start-ride/<uuid:ride_id>/", StartRideView.as_view(), name="start-ride"),
    path("driver/update-ride/<uuid:pk>/", UpdateCarpoolRideView.as_view(), name="update-ride"),
    path("driver/complete-ride/<uuid:ride_id>/", CompleteRideView.as_view(), name="complete-ride"),
    path('rides/history/', RideHistoryView.as_view(), name='ride-history'),
    #driver location
    # path('driver/api/driver-location/<uuid:ride_id>/', DriverLocationView.as_view(), name='driver_location'),
    path('driver/api/driver-location/<uuid:ride_id>/', DriverLocationView.as_view(), name='driver-location'),
    path("api/get-map-key/", GetMapKeyView.as_view(), name="get_map_key"),

    path("driver/api/optimize-route", OptimizeRouteView.as_view(), name="optimize_route"),
    path("notifications/", SendNotificationView.as_view(), name="send-notification"),
    path('tiles/<int:z>/<int:x>/<int:y>/', google_maps_tile, name='google_maps_tile'),
    
    # Reset users' cooldown (Admin only)
    path("admin/reset-cooldown/", AdminResetCooldownView.as_view(), name="admin-reset-cooldown"),

    # Resolve disputes (Admin only)
    # path("admin/resolve-dispute/<int:dispute_id>/", ResolveDisputeView.as_view(), name="resolve-dispute"),
    path("admin/resolve-dispute/<int:dispute_id>/", ResolveDisputeView.as_view(), name="resolve-dispute"),
    path("all-disputes/", AllDisputesView.as_view(), name="all-disputes"),

    # Passenger dashboard
    path("dashboard/", UserDashboardView.as_view(), name="user-dashboard"),
    path('passenger/api/driver-location/<uuid:ride_id>/', PassengerDriverLocationView.as_view(), name='passenger-driver-location'),

    # Cancel a ride
    path("cancel-ride/<uuid:carpoolride_id>/", CancelRideView.as_view(), name="cancel-ride"),

    # Get driver live location
    # path("driver-location/<uuid:ride_id>/", GetDriverLiveLocationView.as_view(), name="driver-live-location"),
    path("passenger/request-to-join", RequestToJoinRideView.as_view(), name="passenger-rquest-to-join-ride"),
    
    # path("wallet/deposit/", DepositToWalletView.as_view(), name="wallet-deposit"),
    # path("wallet/pay-ride/<int:ride_id>/", PayForRideWithWalletView.as_view(), name="wallet-pay-ride"),
    path("wallet/release-payment/<uuid:carpoolride_id>/", ReleaseRidePaymentToDriverView.as_view(), name="wallet-release-payment"),
    path("wallet/withdraw/", WithdrawToMpesaView.as_view(), name="wallet-withdraw"),
    path("dispute/submit/", SubmitDisputeView.as_view(), name="submit-dispute"),
    path("dispute/list/", UserDisputeListView.as_view(), name="user-dispute-list"),
    
    
    # path("api/mpesa/callback/", MpesaCallbackView.as_view(), name="mpesa-callback"),
    path("api/wallet/topup/mock-callback/", WalletTopUpCallbackView.as_view(), name="mock-wallet-callback"),
    # path("wallet/deposit/", DepositToWalletView.as_view(), name="deposit"),
    path("wallet/transfer/", TransferFundsView.as_view(), name="transfer"),
    path("wallet/withdraw/", WithdrawToMpesaView.as_view(), name="withdraw"),
    path("wallet/pay-ride/<uuid:carpoolride_id>/", PayForRideWithWalletView.as_view(), name="pay-ride"),
    
    # authentication
    path('register', RegisterView.as_view(), name='register'),
    path('login', LoginView.as_view(), name='login'),
    path("api/google-login", google_login, name="google-login"),
    path('verify-email/', VerifyEmail.as_view(), name='verify-email'),
    path('password-reset-request/', PasswordResetRequestView.as_view(), name='password-reset-request'),
    path('password-reset/', PasswordResetView.as_view(), name='password-reset'),
    path('auth/update-fcm-token/', UpdateFCMTokenView.as_view(), name='update-fcm'),
    path('logout', LogoutView.as_view(),name='logout'),
    path('auth/profile', UserProfileView.as_view(), name='user-profile'),
    path('refresh-token/', CustomTokenRefreshView.as_view(), name='token-refresh'),
    
]
