# backend/rentals/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    PropertyViewSet, UnitViewSet, TenantViewSet,
    ApplicationViewSet, PaymentViewSet, MaintenanceTicketViewSet
)

router = DefaultRouter()
router.register(r'properties', PropertyViewSet)
router.register(r'units', UnitViewSet)
router.register(r'tenants', TenantViewSet)
router.register(r'applications', ApplicationViewSet)
router.register(r'payments', PaymentViewSet)
router.register(r'tickets', MaintenanceTicketViewSet)

urlpatterns = [
    path('', include(router.urls)),
]