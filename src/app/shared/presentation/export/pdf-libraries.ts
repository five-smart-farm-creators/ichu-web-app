/** Loads the PDF writer and its table plugin on first use, which keeps both out of the initial bundle. */
export async function loadPdfLibraries() {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  return { jsPDF, autoTable };
}
