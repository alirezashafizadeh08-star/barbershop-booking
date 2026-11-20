export interface BookingFormData {
  fullName: string;
  phone: string;
  serviceIds: string[];
  date: string;
  time: string;
}

export interface BookingValidationErrors {
  fullName?: string;
  phone?: string;
  serviceIds?: string;
  date?: string;
  time?: string;
}
