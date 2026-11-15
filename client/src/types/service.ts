export interface Service {
  id: string;
  name: string;
  durationMinutes: number;
  priceToman: number;
}

export interface ServicesResponse {
  services: Service[];
}
