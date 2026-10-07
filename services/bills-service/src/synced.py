from common.sync import Collection

from .models import Bill, BillPayment
from .schemas import BillRecord, PaymentRecord

COLLECTIONS = [
    Collection("bills", Bill, BillRecord),
    Collection("payments", BillPayment, PaymentRecord),
]
