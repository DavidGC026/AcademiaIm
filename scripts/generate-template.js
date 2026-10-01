const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Asegurar que exista la carpeta public
const publicDir = path.join(__dirname, '..', 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

const wb = XLSX.utils.book_new();
const wsData = [
  ["Pregunta", "Opcion_A", "Opcion_B", "Opcion_C", "Opcion_D", "Respuesta_Correcta"],
  ["¿Qué es el concreto?", "Un material compuesto por cemento, agregados, agua y aditivos", "Un polímero termoestable", "Un tipo de metal de alta resistencia", "Madera tratada para exteriores", "A"],
  ["¿Cuál es la relación agua/cemento máxima recomendada para concreto expuesto a congelación y deshielo?", "0.65", "0.55", "0.45", "0.80", "C"],
  ["¿Qué aditivo se utiliza para retrasar el tiempo de fraguado del concreto?", "Acelerante", "Retardante", "Inclusor de aire", "Superplastificante", "B"],
  ["¿A qué edad del concreto se especifica convencionalmente su resistencia de diseño (f'c)?", "7 días", "14 días", "28 días", "90 días", "C"]
];

const ws = XLSX.utils.aoa_to_sheet(wsData);

// Ajustar ancho de columnas para mejor visualización
const wscols = [
  {wch: 50}, // Pregunta
  {wch: 25}, // Opcion_A
  {wch: 25}, // Opcion_B
  {wch: 25}, // Opcion_C
  {wch: 25}, // Opcion_D
  {wch: 20}  // Respuesta_Correcta
];
ws['!cols'] = wscols;

XLSX.utils.book_append_sheet(wb, ws, "Examen Template");

const templatePath = path.join(publicDir, 'plantilla_examen.xlsx');
XLSX.writeFile(wb, templatePath);
console.log('Plantilla de examen generada exitosamente en:', templatePath);
