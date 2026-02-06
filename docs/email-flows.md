# Flujos de envío de correo

Inventario de todos los puntos donde la app envía email (novedades, cambios de estado, mensajes). Todos usan el servicio unificado: **Resend primero, fallback SMTP**, y **links/redirect al entorno actual** (local / staging / producción).

---

## 1. Verificación de email (registro)

| Qué | Tras registro (jugador/coach/club). |
| Destinatario | Email del usuario recién registrado. |
| Dónde | `use-auth.tsx` → signUp. |
| Cómo | **Server action** `requestVerificationEmail(email)` → `sendVerificationEmail(uid, email)` (template + continueUrl). |
| Estado | ✅ Unificado (tras usar la action en el cliente). |

---

## 2. Reenviar verificación (página “Verifica tu email”)

| Qué | Usuario pide “Reenviar email de verificación”. |
| Destinatario | Email que ingresa en la página. |
| Dónde | `verify-email/page.tsx` → botón “Reenviar Email de Verificación”. |
| Cómo | **Server action** `requestVerificationEmail(email)` → busca usuario por email → `sendVerificationEmail(uid, email)`. |
| Estado | ✅ Unificado (tras usar la action en verify-email). |

---

## 3. Olvidé contraseña (login / admin login)

| Qué | Usuario pide restablecer contraseña por email. |
| Destinatario | Email que ingresa. |
| Dónde | `use-auth.tsx` → resetPassword; `login-form.tsx` y `admin/login/page.tsx`. |
| Cómo | **Server action** `requestPasswordReset(email)` → `sendPasswordResetEmail(email)` (template + continueUrl). |
| Estado | ✅ Unificado (tras usar la action en el cliente). |

---

## 4. Admin: enviar link de restablecimiento (jugador/coach/club)

| Qué | Admin pide “enviar reset” para un usuario (por userId). |
| Destinatario | Email del usuario (players/coaches/clubs o Auth). |
| Dónde | `actions.ts` → adminSendPasswordReset. |
| Cómo | `generatePasswordResetLink(email, { url: getAppBaseUrl() })` y devuelve el link al admin (no envía email desde aquí). |
| Estado | ✅ continueUrl correcto. |

---

## 5. Admin: activar coach y enviar contraseña

| Qué | Admin activa coach y envía email con link para crear contraseña. |
| Destinatario | Email del coach. |
| Dónde | `actions.ts` → adminActivateCoachAndSendPassword. |
| Cómo | `generatePasswordResetLink(email, { url: getAppBaseUrl() })` + `sendCustomEmail` con el link. |
| Estado | ✅ Unificado + continueUrl. |

---

## 6. Nueva solicitud de entrenador (formulario)

| Qué | Alguien envía el formulario de registro como coach. |
| Destinatario | Admin (ADMIN_NOTIFICATION_EMAILS o fallback). |
| Dónde | `actions.ts` → submit del form coach. |
| Cómo | `sendAdminNotification` (asunto + HTML con datos). |
| Estado | ✅ Unificado. |

---

## 7. Nueva solicitud de entrenador (API)

| Qué | POST a API de coach-applications. |
| Destinatario | Admin. |
| Dónde | `api/coach-applications/route.ts`. |
| Cómo | `sendAdminNotification`. |
| Estado | ✅ Unificado. |

---

## 8. Nuevo ticket de soporte

| Qué | Usuario crea un ticket. |
| Destinatario | Admin. |
| Dónde | `api/tickets/route.ts`. |
| Cómo | `sendAdminNotification`. |
| Estado | ✅ Unificado. |

---

## 9. Nuevo mensaje en ticket (admin responde)

| Qué | Admin escribe en un ticket. |
| Destinatario | Email del usuario del ticket. |
| Dónde | `api/tickets/[id]/messages/route.ts`. |
| Cómo | `sendCustomEmail` (asunto “Respuesta a tu ticket” + cuerpo). |
| Estado | ✅ Unificado. |

---

## 10. Nuevo mensaje en ticket (usuario escribe)

| Qué | Usuario escribe en su ticket. |
| Destinatario | Admin. |
| Dónde | `api/tickets/[id]/messages/route.ts`. |
| Cómo | `sendAdminNotification` (“Nuevo mensaje en ticket”). |
| Estado | ✅ Unificado. |

---

## 11. Análisis pagado (Mercado Pago → coach)

| Qué | Jugador paga la revisión manual; se notifica al coach. |
| Destinatario | Email del coach. |
| Dónde | `lib/mercadopago.ts` (webhook / flujo coach_review). |
| Cómo | `sendCustomEmail` (“Nuevo análisis pagado para revisión” + link al análisis). |
| Estado | ✅ Unificado; link usa `getAppBaseUrl()`. |

---

## 12. Recordatorio: devolución pendiente (coach)

| Qué | Cron/job que revisa análisis con devolución pendiente (ej. 5 días). |
| Destinatario | Email del coach. |
| Dónde | `api/admin/coach-reminders/run/route.ts`. |
| Cómo | `sendCustomEmail` (“Recordatorio: devolución pendiente” + link). |
| Estado | ✅ Unificado. |

---

## 13. Coach comenta un fotograma (jugador)

| Qué | El coach deja un comentario en un fotograma del análisis. |
| Destinatario | Email del jugador. |
| Dónde | `api/analyses/[id]/keyframe-comments/route.ts` (POST). |
| Cómo | Tras guardar el mensaje en la bandeja, `sendCustomEmail` al jugador (“Tu entrenador te dejó un comentario” + link al análisis). |
| Estado | ✅ Unificado. |

---

## 14. Coach completa la devolución (jugador)

| Qué | El coach marca el análisis como revisado/completado. |
| Destinatario | Email del jugador. |
| Dónde | `api/analyses/[id]/complete/route.ts` (POST). |
| Cómo | Tras guardar el mensaje en la bandeja, `sendCustomEmail` al jugador (“Tu análisis fue revisado – ya está tu devolución” + link). |
| Estado | ✅ Unificado. |

---

## 15. Nuevo video subido (admin)

| Qué | Se sube un video para análisis. |
| Destinatario | Admin. |
| Dónde | `actions.ts` (flujo de subida de video). |
| Cómo | `sendAdminNotification` (“Nuevo video subido para análisis” + link a revisión IA). |
| Estado | ✅ Unificado; link usa `getAppBaseUrl()`. |

---

## Resumen

- **Servicio:** Todos los envíos pasan por `email-service` (Resend → SMTP) y usan `getAppBaseUrl()` para links/redirect.
- **Verificación y “olvidé contraseña”:** Se disparan desde **server actions** (`requestVerificationEmail`, `requestPasswordReset`) para usar templates y continueUrl del entorno actual.
- **Coach → jugador:** Comentario en fotograma (13) y devolución completada (14) envían email al jugador.
- **Admin / tickets / pagos / recordatorios / nuevo video:** Usan `sendAdminNotification` o `sendCustomEmail` del servicio unificado.

Si agregás un nuevo flujo (ej. mensaje jugador → coach), usá `sendCustomEmail` o `sendAdminNotification` y, si hay link, construilo con `getAppBaseUrl()`.
