import { z } from 'zod';

export const esquemaLogin = z.object({
  email: z.email('Ingresa un email válido.'),
  password: z.string().min(1, 'Ingresa tu contraseña.'),
  next: z.string().optional(),
});
