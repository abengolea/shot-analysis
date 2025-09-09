import Link from "next/link";

export default function AdminHome() {
	return (
		<div className="p-6 space-y-4">
			<h1 className="text-xl font-semibold">Admin</h1>
			<ul className="list-disc pl-6 space-y-2">
				<li>
					<Link className="text-blue-600 underline" href="/admin/labeling">Herramienta de etiquetado</Link>
				</li>
				<li>
					<Link className="text-blue-600 underline" href="/admin/upload-analyze">Subir JSON y analizar</Link>
				</li>
				<li>
					<Link className="text-blue-600 underline" href="/admin/scoring">Ponderaciones de Puntuación</Link>
				</li>
				<li>
					<Link className="text-blue-600 underline" href="/admin/help">Ayuda</Link>
				</li>
			</ul>
		</div>
	);
}
