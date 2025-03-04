from django.urls import path
import uuid
from .views import( SubmitDisputeView, ResolveDisputeView, UserDisputeListView,
 DriverDashboardView,
    UploadIDImageView,
    UploadSmartDLView,
    WalletBalanceView,
    PayoutRequestView,
    DriverAvailabilityView,
    ApproveRideRequestView,
    RejectRideRequestView,
    CreateCarpoolRideView,
    UpdateDriverLocationView,
    GetDriverLocationView,
    start_ride,
    AdminResetCooldownView,
    ResolveDisputeView,
    UserDashboardView,
    CancelRideView,
    GetDriverLiveLocationView,
    
    DepositToWalletView,
    PayForRideWithWalletView,
    ReleaseRidePaymentToDriverView,
    WithdrawToMpesaView,
    SubmitDisputeView,
    UserDisputeListView,
    DepositWalletView,
    WithdrawWalletView,
    TransferFundsView,
)
urlpatterns = [
    path("dispute/submit/", SubmitDisputeView.as_view(), name="submit_dispute"),
    path("dispute/<uuid:dispute_id>/resolve/", ResolveDisputeView.as_view(), name="resolve_dispute"),
    path("dispute/list/", UserDisputeListView.as_view(), name="user_disputes"),
    
    #driver
    path("driver/dashboard/", DriverDashboardView.as_view(), name="driver-dashboard"),
    path("driver/upload-id/", UploadIDImageView.as_view(), name="upload-id"),
    path("driver/upload-smart-dl/", UploadSmartDLView.as_view(), name="upload-smart-dl"),
    path("driver/wallet/", WalletBalanceView.as_view(), name="wallet-balance"),
    path("driver/payout/", PayoutRequestView.as_view(), name="payout-request"),
    path("driver/availability/", DriverAvailabilityView.as_view(), name="driver-availability"),
    path("driver/ride-request/approve/<int:pk>/", ApproveRideRequestView.as_view(), name="approve-ride-request"),
    path("driver/ride-request/reject/<int:pk>/", RejectRideRequestView.as_view(), name="reject-ride-request"),
    path("driver/create-ride/", CreateCarpoolRideView.as_view(), name="create-carpool-ride"),
    path("driver/update-location/", UpdateDriverLocationView.as_view(), name="update-driver-location"),
    path("passenger/driver-location/<int:ride_id>/", GetDriverLocationView.as_view(), name="get-driver-location"),
    path("driver/start-ride/<int:ride_id>/", start_ride, name="start-ride"),
    
    # Reset users' cooldown (Admin only)
    path("admin/reset-cooldown/", AdminResetCooldownView.as_view(), name="admin-reset-cooldown"),

    # Resolve disputes (Admin only)
    path("admin/resolve-dispute/<int:dispute_id>/", ResolveDisputeView.as_view(), name="resolve-dispute"),

    # Passenger dashboard
    path("dashboard/", UserDashboardView.as_view(), name="user-dashboard"),

    # Cancel a ride
    path("cancel-ride/<int:ride_id>/", CancelRideView.as_view(), name="cancel-ride"),

    # Get driver live location
    path("driver-location/<int:ride_id>/", GetDriverLiveLocationView.as_view(), name="driver-live-location"),
    
    path("wallet/deposit/", DepositToWalletView.as_view(), name="wallet-deposit"),
    path("wallet/pay-ride/<int:ride_id>/", PayForRideWithWalletView.as_view(), name="wallet-pay-ride"),
    path("wallet/release-payment/<int:ride_id>/", ReleaseRidePaymentToDriverView.as_view(), name="wallet-release-payment"),
    path("wallet/withdraw/", WithdrawToMpesaView.as_view(), name="wallet-withdraw"),
    path("dispute/submit/", SubmitDisputeView.as_view(), name="submit-dispute"),
    path("dispute/list/", UserDisputeListView.as_view(), name="user-dispute-list"),
    path("wallet/deposit-funds/", DepositWalletView.as_view(), name="deposit-funds"),
    path("wallet/withdraw-funds/", WithdrawWalletView.as_view(), name="withdraw-funds"),
    path("wallet/transfer/", TransferFundsView.as_view(), name="transfer-funds"),
]
