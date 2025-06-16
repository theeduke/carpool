from django.urls import path, include
import uuid
from rest_framework.routers import DefaultRouter
# SubmitDisputeView, ResolveDisputeView, AllDisputesView,UserDisputeListView, DisputeRideView,

from .views import(
 DriverDashboardView,
 ChatReceiverProfileView,
    DriverRideRequestsView,
    DriverRegisterView,
    UpdateCarpoolRideView,
    UploadIDImageView,
    # UploadSmartDLView,
    WalletBalanceView,
    UserWalletBalanceView,
    # PayoutRequestView,
    DriverAvailabilityView,
    OptimizeRouteView,
    SendNotificationView,
    DismissNotificationView,
    # ApproveRideRequestView,
    AcceptRideRequestView,
    # RejectRideRequestView,
    DeclineRideRequestView,
    CreateCarpoolRideView,
    RideHistoryView,
    ChatHistoryView,
    UnreadMessagesView,
    UpdateDriverLocationView,
    # GetDriverLocationView,
    # start_ride,
    StartRideView,
    CompleteRideView,
    # AdminResetCooldownView,
    # ResolveDisputeView,
    UserDashboardView,
    PassengerDriverLocationView,
    RequestToJoinRideView,PassengerRideRequestListView,
    AcceptRideMatchView,   DeclineRideMatchView, PassengerRideMatchesView,
    CancelRideView,
    # GetDriverLiveLocationView,
    DriverLocationView,
    GetMapKeyView,
    # google_maps_tile,
    
    # DepositToWalletView,
    PayForRideWithWalletView,
    ReleaseRidePaymentToDriverView,
    # WithdrawToMpesaView,
    # SubmitDisputeView,
    # UserDisputeListView,
    TransferFundsView,
    MockWalletController,
    # MpesaCallbackView,
    WalletTopUpCallbackView,
    
    RegisterView,LoginView, google_login, VerifyEmail, PasswordResetRequestView, PasswordResetView, LogoutView,
    CustomTokenRefreshView, UserProfileView, UpdateFCMTokenView,UpdateUserPreferencesView,
    
    CarpoolRideViewSet, PassengerCarpoolRideViewSet,
    VehicleMakeListView, VehicleModelListView, DriverVehicleView,
    
    DownloadRideHistoryView, UserReportsView, PaymentReceiptView, DriverEarningsView,PassengerSpendingView 
)


router = DefaultRouter()
router.register(r'driver/rides', CarpoolRideViewSet, basename='driver-rides')  # for drivers
router.register(r'passenger/available-rides', PassengerCarpoolRideViewSet, basename='passenger-rides')  #for passengers
router.register(r"wallet/mock", MockWalletController, basename="mock-wallet")



urlpatterns = [
        #routers
    path('', include(router.urls)),
    
    # vehicles
    path('vehicle-makes/', VehicleMakeListView.as_view(), name='vehicle-makes'),
    path('vehicle-models/', VehicleModelListView.as_view(), name='vehicle-models'),
    path('driver/vehicle/', DriverVehicleView.as_view(), name='driver-vehicle'),
    
    # profile
    path('profile/', UserProfileView.as_view(), name='user-profile'),
    path('preferences/', UpdateUserPreferencesView.as_view(), name='update-preferences'),
    
    
    # #driver
    path("register/driver/", DriverRegisterView.as_view(), name="driver-register"),
    path("driver/dashboard/", DriverDashboardView.as_view(), name="driver-dashboard"),
    path("driver/ride-requests", DriverRideRequestsView.as_view(), name="driver ride requests"),
    path("driver/upload-id/", UploadIDImageView.as_view(), name="upload-id"),

    path("driver/wallet/", WalletBalanceView.as_view(), name="wallet-balance"),
   
    path("driver/availability/", DriverAvailabilityView.as_view(), name="driver-availability"),
    path("driver/ride-request/approve/<uuid:pk>/", AcceptRideRequestView.as_view(), name="approve-ride-request"),
    path("driver/ride-request/decline/<uuid:pk>/", DeclineRideRequestView.as_view(), name="reject-ride-request"),
    path("driver/create-ride/", CreateCarpoolRideView.as_view(), name="create-carpool-ride"),
    path("driver/update-location/", UpdateDriverLocationView.as_view(), name="update-driver-location"),
    path("driver/start-ride/<uuid:ride_id>/", StartRideView.as_view(), name="start-ride"),
    path("driver/update-ride/<uuid:pk>/", UpdateCarpoolRideView.as_view(), name="update-ride"),
    path("driver/complete-ride/<uuid:ride_id>/", CompleteRideView.as_view(), name="complete-ride"),
    path('rides/history/', RideHistoryView.as_view(), name='ride-history'),
    
    # chat
    path('api/chat/<uuid:carpoolride_id>', ChatHistoryView.as_view(), name='chat-history'),
    path('api/messages/unread/', UnreadMessagesView.as_view(), name='unread-messages'),
    path('profile/<uuid:user_id>/', ChatReceiverProfileView.as_view(), name='chat-receiver-profile'),
    
    #driver location
    path('driver/api/driver-location/<uuid:ride_id>/', DriverLocationView.as_view(), name='driver-location'),
    path("api/get-map-key/", GetMapKeyView.as_view(), name="get_map_key"),
    path("driver/api/optimize-route", OptimizeRouteView.as_view(), name="optimize_route"),
    path("notifications/", SendNotificationView.as_view(), name="send-notification"),
  
    
    #dismin notifications
    path('api/dismiss-notification/<uuid:notification_id>/', DismissNotificationView.as_view(), name='dismiss_notification'),
    

    # Passenger dashboard
    path("dashboard/", UserDashboardView.as_view(), name="user-dashboard"),
    path('passenger/api/driver-location/<uuid:ride_id>/', PassengerDriverLocationView.as_view(), name='passenger-driver-location'),

    # Cancel a ride
    path("cancel-ride/<uuid:carpoolride_id>/", CancelRideView.as_view(), name="cancel-ride"),

    # Get driver live location
    path("passenger/request-to-join", RequestToJoinRideView.as_view(), name="passenger-rquest-to-join-ride"),
    path('passenger/ride-requests/', PassengerRideRequestListView.as_view(), name='passenger-ride-requests'),
    path("passenger/ride-match/<uuid:match_id>/accept/", AcceptRideMatchView.as_view(), name="accept-ride-match"),
    path("ride-match/<uuid:match_id>/decline/", DeclineRideMatchView.as_view(), name="decline-ride-match"),
    path("passenger/ride-matches/", PassengerRideMatchesView.as_view(), name="passenger-ride-matches"),
    path("wallet/release-payment/<uuid:carpoolride_id>/", ReleaseRidePaymentToDriverView.as_view(), name="wallet-release-payment"),
    path('wallet/balance/', UserWalletBalanceView.as_view(), name='wallet-balance'),
    path("api/wallet/topup/mock-callback/", WalletTopUpCallbackView.as_view(), name="mock-wallet-callback"),
    path("wallet/transfer/", TransferFundsView.as_view(), name="transfer"),
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
    # reports
    path('reports/ride-history/', DownloadRideHistoryView.as_view(), name='ride-history'),
    path('reports/', UserReportsView.as_view(), name='user-reports'),
    path('reports/payment-receipt/', PaymentReceiptView.as_view(), name='payment-receipt'),
    path('reports/driver-earnings/', DriverEarningsView.as_view(), name='driver-earnings'),
    path('reports/passenger-spending/', PassengerSpendingView.as_view(), name='passenger-spending'),
    
    
]
