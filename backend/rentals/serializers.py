from rest_framework import serializers
from .models import Property, Unit, Tenant, Application, Payment, MaintenanceTicket

class PropertySerializer(serializers.ModelSerializer):
    class Meta:
        model = Property
        fields = '__all__'

class UnitSerializer(serializers.ModelSerializer):
    class Meta:
        model = Unit
        fields = '__all__'

class TenantSerializer(serializers.ModelSerializer):
    unit_code = serializers.CharField(source='unit.unit_code', read_only=True)
    class Meta:
        model = Tenant
        fields = '__all__'

class ApplicationSerializer(serializers.ModelSerializer):
    unit_code = serializers.CharField(source='unit.unit_code', read_only=True)
    unit_rent = serializers.DecimalField(source='unit.rent', max_digits=10, decimal_places=2, read_only=True)
    class Meta:
        model = Application
        fields = '__all__'

class PaymentSerializer(serializers.ModelSerializer):
    tenant_name = serializers.CharField(source='tenant.name', read_only=True)
    unit_code = serializers.CharField(source='tenant.unit.unit_code', read_only=True)
    class Meta:
        model = Payment
        fields = '__all__'

class MaintenanceTicketSerializer(serializers.ModelSerializer):
    tenant_name = serializers.CharField(source='tenant.name', read_only=True)
    unit_code = serializers.CharField(source='unit.unit_code', read_only=True)
    class Meta:
        model = MaintenanceTicket
        fields = '__all__'