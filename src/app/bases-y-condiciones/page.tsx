import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Bases y Condiciones de Uso - Chaaaas",
  description: "Bases y Condiciones de Uso de la plataforma Chaaaas",
};

export default function BasesYCondicionesPage() {
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
            BASES Y CONDICIONES DE USO
          </h1>

          <div className="prose prose-gray max-w-none">
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">1. Titularidad</h2>
              <p className="text-gray-700 leading-relaxed">
                La aplicación y plataforma web Chaaaas (en adelante, "la App") es de titularidad de Notificas SRL, 
                con domicilio en Calle Colón 12, San Nicolás de los Arroyos, Provincia de Buenos Aires, Argentina 
                (en adelante, "la Empresa").
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">2. Objeto de la App</h2>
              <p className="text-gray-700 leading-relaxed">
                La App tiene como finalidad ofrecer a jugadores y jugadoras de básquet un sistema de análisis técnico 
                de lanzamientos mediante el uso de inteligencia artificial y visión por computadora, con el objetivo de 
                brindar devoluciones técnicas y facilitar la mejora en su desempeño deportivo.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">3. Aceptación de las Condiciones</h2>
              <p className="text-gray-700 leading-relaxed">
                El acceso y uso de la App implica la aceptación plena de las presentes Bases y Condiciones. Si el usuario 
                no está de acuerdo con ellas, deberá abstenerse de utilizar la App.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">4. Registro y Acceso</h2>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>El registro requiere el ingreso de datos personales verídicos.</li>
                <li>Los usuarios menores de 18 años deben contar con la autorización de sus padres, madres o tutores legales para utilizar la App.</li>
                <li>La Empresa podrá suspender o dar de baja usuarios que incumplan estas condiciones.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">5. Servicios y Análisis</h2>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>Cada usuario registrado podrá acceder a dos (2) análisis gratuitos por año.</li>
                <li>Análisis adicionales podrán ser adquiridos mediante los sistemas de pago habilitados en la App.</li>
                <li>La Empresa podrá modificar precios, condiciones y promociones sin previo aviso, garantizando siempre la finalización de los servicios ya contratados.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">6. Uso de la Información y Responsabilidad</h2>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>La App brinda devoluciones técnicas de carácter orientativo, que no reemplazan la instrucción deportiva profesional.</li>
                <li>La Empresa no se responsabiliza por lesiones, malos usos o interpretaciones derivadas del uso de la App.</li>
                <li>El usuario es responsable del uso correcto de la plataforma y de los contenidos que suba.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">7. Propiedad Intelectual</h2>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>Todos los contenidos, software, marcas, diseños y funcionalidades de la App son propiedad de Notificas SRL.</li>
                <li>Queda prohibida su reproducción, distribución o modificación sin autorización expresa de la Empresa.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">8. Protección de Datos Personales</h2>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>Los datos proporcionados por los usuarios serán tratados conforme a la Ley 25.326 de Protección de Datos Personales (Argentina).</li>
                <li>El usuario podrá solicitar en cualquier momento la rectificación o supresión de sus datos enviando un correo electrónico a: contacto@chaaaas.com</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">9. Conflictos y Reclamos</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                En caso de surgir un reclamo, conflicto o divergencia entre el usuario y la Empresa, el usuario acepta 
                y se compromete a iniciar previamente un reclamo extrajudicial obligatorio a través de la plataforma 
                gratuita{" "}
                <a 
                  href="https://conciliaya.com.ar/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  conciliaya.com.ar
                </a>.
              </p>
              <p className="text-gray-700 leading-relaxed">
                Solo una vez agotada dicha instancia, y en caso de no arribar a un acuerdo, el usuario podrá iniciar 
                reclamos administrativos o judiciales.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">10. Limitación de Responsabilidad</h2>
              <p className="text-gray-700 leading-relaxed">
                La Empresa no garantiza la disponibilidad continua e ininterrumpida de la App, pudiendo suspenderla 
                temporalmente por razones técnicas, de seguridad o mantenimiento.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">11. Jurisdicción y Ley Aplicable</h2>
              <p className="text-gray-700 leading-relaxed">
                Estas Bases y Condiciones se rigen por las leyes de la República Argentina. Toda controversia será 
                sometida a los tribunales ordinarios de la ciudad de San Nicolás de los Arroyos, Provincia de Buenos Aires, 
                con renuncia expresa a cualquier otro fuero o jurisdicción.
              </p>
            </section>

            <div className="mt-12 pt-8 border-t border-gray-200 text-center">
              <p className="text-sm text-gray-500">
                Última actualización: {new Date().toLocaleDateString('es-AR')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
