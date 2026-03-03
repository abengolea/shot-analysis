import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Política de Privacidad - Chaaaas",
  description: "Política de Privacidad de la plataforma Chaaaas",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6">
          <Button variant="ghost" asChild>
            <Link href="/" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Volver al inicio
            </Link>
          </Button>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-8">
          <h1 className="font-headline text-3xl font-bold text-gray-900 mb-8 text-center">
            POLÍTICA DE PRIVACIDAD
          </h1>

          <div className="prose prose-gray max-w-none">
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">1. Responsable del tratamiento</h2>
              <p className="text-gray-700 leading-relaxed">
                Notificas SRL, con domicilio en Calle Colón 12, San Nicolás de los Arroyos, Provincia de Buenos Aires, Argentina, 
                es el responsable del tratamiento de los datos personales recogidos a través de la plataforma Chaaaas (en adelante, &quot;la App&quot;).
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">2. Datos que recogemos</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Recogemos los siguientes tipos de datos:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li><strong>Datos de registro:</strong> nombre, email, contraseña (encriptada).</li>
                <li><strong>Datos de perfil:</strong> fecha de nacimiento, país, nivel deportivo, posición, altura, envergadura (jugadores); experiencia, tarifa, biografía (entrenadores).</li>
                <li><strong>Contenido que subís:</strong> videos de lanzamientos para análisis, imágenes de perfil.</li>
                <li><strong>Datos de uso:</strong> sesiones, páginas visitadas, duración de visita (para mejorar el servicio).</li>
                <li><strong>Datos de pago:</strong> información necesaria para procesar pagos a través de MercadoPago y dLocal (no almacenamos datos de tarjetas).</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">3. Finalidad del tratamiento</h2>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>Proporcionar el servicio de análisis técnico de lanzamientos.</li>
                <li>Gestionar tu cuenta y perfil.</li>
                <li>Procesar pagos y facturación.</li>
                <li>Enviar comunicaciones relacionadas con el servicio (verificación de email, recuperación de contraseña, notificaciones de análisis).</li>
                <li>Mejorar la plataforma mediante métricas de uso anónimas o agregadas.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">4. Base legal y conservación</h2>
              <p className="text-gray-700 leading-relaxed">
                El tratamiento se basa en tu consentimiento (registro) y en la ejecución del contrato de servicios. 
                Conservamos los datos mientras mantengas una cuenta activa. Tras solicitar la eliminación, borramos tus datos en un plazo razonable (máximo 30 días), 
                salvo los que debamos conservar por obligación legal.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">5. Compartir datos con terceros</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Utilizamos los siguientes servicios que pueden procesar datos en nuestro nombre:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li><strong>Firebase (Google):</strong> autenticación, base de datos, almacenamiento de archivos.</li>
                <li><strong>Google Gemini:</strong> análisis de videos mediante inteligencia artificial.</li>
                <li><strong>MercadoPago / dLocal:</strong> procesamiento de pagos.</li>
                <li><strong>AWS (opcional):</strong> reconocimiento de video, envío de emails.</li>
                <li><strong>SendGrid (opcional):</strong> envío de emails transaccionales.</li>
              </ul>
              <p className="text-gray-700 leading-relaxed mt-4">
                No vendemos ni alquilamos tus datos personales a terceros con fines comerciales.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">6. Tus derechos</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Podés ejercer los siguientes derechos conforme a la Ley 25.326 (Argentina) y normativas aplicables:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li><strong>Acceso:</strong> conocer qué datos tenemos sobre vos.</li>
                <li><strong>Rectificación:</strong> corregir datos inexactos o incompletos.</li>
                <li><strong>Supresión:</strong> solicitar la eliminación de tus datos y de tu cuenta.</li>
                <li><strong>Portabilidad:</strong> recibir tus datos en formato estructurado.</li>
              </ul>
              <p className="text-gray-700 leading-relaxed mt-4">
                Para ejercer estos derechos, podés usar el botón &quot;Eliminar mi cuenta&quot; en tu perfil, o enviar un correo a{" "}
                <a href="mailto:contacto@chaaaas.com" className="text-blue-600 hover:underline">contacto@chaaaas.com</a>.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">7. Seguridad</h2>
              <p className="text-gray-700 leading-relaxed">
                Implementamos medidas técnicas y organizativas para proteger tus datos contra accesos no autorizados, pérdida o alteración. 
                Las contraseñas se almacenan de forma encriptada. Los videos y análisis se almacenan en infraestructura segura (Firebase, Google Cloud).
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">8. Menores</h2>
              <p className="text-gray-700 leading-relaxed">
                Los menores de 18 años deben contar con autorización de padres, madres o tutores legales para utilizar la App. 
                No recogemos conscientemente datos de menores sin dicha autorización.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">9. Cambios a esta política</h2>
              <p className="text-gray-700 leading-relaxed">
                Podemos actualizar esta política ocasionalmente. Los cambios relevantes se comunicarán por email o mediante un aviso en la App. 
                El uso continuado de la App tras los cambios implica la aceptación de la política actualizada.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">10. Contacto</h2>
              <p className="text-gray-700 leading-relaxed">
                Para consultas sobre privacidad o ejercicio de derechos:{" "}
                <a href="mailto:contacto@chaaaas.com" className="text-blue-600 hover:underline">contacto@chaaaas.com</a>.
              </p>
            </section>

            <div className="mt-12 pt-8 border-t border-gray-200 text-center">
              <p className="text-sm text-gray-500">
                Última actualización: {new Date().toLocaleDateString("es-AR")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
