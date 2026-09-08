import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';

const TecniProPresupuestos = () => {
  const [tab, setTab] = useState('precios');
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState(() => {
    const saved = localStorage.getItem('tecnipro-config');
    return saved ? JSON.parse(saved) : {
      email: 'tecniproapp@gmail.com',
      telefono: '3537580548',
      direccion: 'Calle 7 N° 555, Ordóñez, Córdoba 2555',
      sitioWeb: '',
      margenDefault: 73
    };
  });
  
  const [presupuesto, setPresupuesto] = useState([]);
  const [clientData, setClientData] = useState({ nombre: '', empresa: '', telefono: '', email: '' });
  const [filtroCategoria, setFiltroCategoria] = useState('todos');
  const [margenActual, setMargenActual] = useState(config.margenDefault);
  const [categoriasOpciones, setCategoriasOpciones] = useState(['todos']);

  // Cargar Google Sheets (Sheet PÚBLICO del proveedor)
  const cargarProductos = async () => {
    setLoading(true);
    try {
      const sheetId = '1iu-qsCOJ9FsHdajPlHr06FjFyfwsotRfRX2dtGFWit8';
      const apiKey = 'AIzaSyBm6yFqSRYCyMwass94G3aR4XeLpwulfMl';
      
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?includeGridData=true&key=${apiKey}`
      );
      const data = await response.json();
      
      const allProducts = [];
      const allCategories = new Set(['todos']);
      
      // Leer todas las hojas
      data.sheets.forEach(sheet => {
        const gridData = sheet.data ? sheet.data[0] : null;
        if (!gridData) return;
        
        const rows = gridData.rowData || [];
        let currentCategory = 'Otros';
        let productId = 1;
        
        rows.forEach((row, idx) => {
          if (!row.values || row.values.length === 0) return;
          
          const cellA = row.values[0]?.userEnteredValue?.stringValue || '';
          const cellB = row.values[1]?.userEnteredValue?.stringValue || '';
          const cellC = row.values[2]?.userEnteredValue?.stringValue || '';
          const cellD = row.values[3]?.userEnteredValue?.numberValue || 0;
          
          // Si es encabezado de categoría
          if (cellA && !cellB && cellA.includes('y')) {
            currentCategory = cellA.trim();
            allCategories.add(currentCategory);
            return;
          }
          
          // Si tiene modelo (columna B) es un producto
          if (cellB && cellB.length > 0) {
            const costo = cellD > 0 ? cellD : 0;
            allProducts.push({
              id: productId++,
              modelo: cellB.trim(),
              categoria: currentCategory,
              descripcion: cellC ? cellC.trim() : '',
              costo: costo,
              foto: ''
            });
          }
        });
      });
      
      setProductos(allProducts);
      setCategoriasOpciones(['todos', ...Array.from(allCategories).filter(c => c !== 'todos').sort()]);
      
    } catch (error) {
      console.error('Error al cargar productos:', error);
      alert('Error al cargar productos. Intenta de nuevo.');
    }
    setLoading(false);
  };

  // Cargar productos al montar la app
  useEffect(() => {
    cargarProductos();
  }, []);

  const calcularPrecio = (costo, margen = margenActual) => {
    const precioLista = costo * (1 + margen / 100);
    const precioContado = precioLista * 0.9;
    return { precioLista, precioContado };
  };

  const agregarAlPresupuesto = (producto) => {
    const precios = calcularPrecio(producto.costo);
    setPresupuesto([...presupuesto, {
      id: producto.id,
      modelo: producto.modelo,
      descripcion: producto.descripcion,
      precioLista: precios.precioLista,
      precioContado: precios.precioContado,
      cantidad: 1,
      tipoPrecio: 'lista'
    }]);
  };

  const generarPDF = async () => {
    const pdf = new jsPDF();
    let yPosition = 20;

    // Header
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.text('TECNIPRO', 20, yPosition);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`${config.telefono} | ${config.email}`, 20, yPosition + 8);
    pdf.text(config.direccion, 20, yPosition + 14);
    yPosition += 30;

    // Datos del presupuesto
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.text('PRESUPUESTO', 20, yPosition);
    yPosition += 8;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.text(`Cliente: ${clientData.nombre}`, 20, yPosition);
    pdf.text(`Empresa: ${clientData.empresa}`, 20, yPosition + 6);
    pdf.text(`Teléfono: ${clientData.telefono}`, 20, yPosition + 12);
    pdf.text(`Email: ${clientData.email}`, 20, yPosition + 18);
    yPosition += 30;

    // Tabla de productos
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    const colX = [20, 80, 140, 160, 180];
    pdf.text('Modelo', colX[0], yPosition);
    pdf.text('Descripción', colX[1], yPosition);
    pdf.text('Cant.', colX[2], yPosition);
    pdf.text('Precio Unit.', colX[3], yPosition);
    pdf.text('Total', colX[4], yPosition);
    yPosition += 8;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    let totalGeneral = 0;

    presupuesto.forEach(item => {
      const precio = item.tipoPrecio === 'lista' ? item.precioLista : item.precioContado;
      const total = precio * item.cantidad;
      totalGeneral += total;

      pdf.text(item.modelo, colX[0], yPosition);
      pdf.text(item.descripcion.substring(0, 30), colX[1], yPosition);
      pdf.text(item.cantidad.toString(), colX[2], yPosition);
      pdf.text(`$${precio.toFixed(0)}`, colX[3], yPosition);
      pdf.text(`$${total.toFixed(0)}`, colX[4], yPosition);
      yPosition += 6;
    });

    // Total
    yPosition += 8;
    pdf.setFont('helvetica', 'bold');
    pdf.text(`TOTAL: $${totalGeneral.toFixed(0)}`, colX[4] - 40, yPosition);
  };

  const descargarPDF = async () => {
    if (!presupuesto.length) {
      alert('El presupuesto está vacío');
      return;
    }

    const fecha = new Date().toISOString().split('T')[0];
    const nombreArchivo = `TecniPro-${fecha}-${clientData.nombre.replace(/\s+/g, '')}-001`;
    const pdf = new jsPDF();
    
    pdf.text(`PRESUPUESTO - ${clientData.nombre}`, 20, 20);
    pdf.save(`${nombreArchivo}.pdf`);

    alert('PDF guardado. Próximamente se subará automático a Google Drive.');
  };

  const actualizarConfig = (key, value) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    localStorage.setItem('tecnipro-config', JSON.stringify(newConfig));
  };

  const productosFiltrados = filtroCategoria === 'todos' ? productos : productos.filter(p => p.categoria === filtroCategoria);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8f8f8', fontFamily: 'system-ui' }}>
      {/* NAVBAR */}
      <nav style={{ backgroundColor: '#0066ff', color: 'white', padding: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '20px', fontWeight: 'bold' }}>TecniPro</div>
          <div style={{ display: 'flex', gap: '24px' }}>
            <button onClick={() => setTab('precios')} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontWeight: tab === 'precios' ? 'bold' : 'normal' }}>
              📋 Precios
            </button>
            <button onClick={() => setTab('presupuestos')} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontWeight: tab === 'presupuestos' ? 'bold' : 'normal' }}>
              🛒 Presupuestos
            </button>
            <button onClick={() => setTab('config')} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontWeight: tab === 'config' ? 'bold' : 'normal' }}>
              ⚙️ Config
            </button>
          </div>
        </div>
      </nav>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
        
        {/* TAB: LISTA DE PRECIOS */}
        {tab === 'precios' && (
          <div>
            <h2>📋 Lista de Precios</h2>
            
            <div style={{ marginBottom: '24px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div>
                <label style={{ fontWeight: 'bold' }}>Filtrar por categoría:</label>
                <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} 
                  style={{ marginLeft: '8px', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
                  {categoriasOpciones.map(cat => <option key={cat} value={cat}>{cat === 'todos' ? 'Todos' : cat}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontWeight: 'bold' }}>Margen (%):</label>
                <input type="number" value={margenActual} onChange={(e) => setMargenActual(Number(e.target.value))}
                  style={{ marginLeft: '8px', padding: '8px', width: '80px', borderRadius: '4px', border: '1px solid #ccc' }} />
              </div>

              <button onClick={cargarProductos} disabled={loading}
                style={{ padding: '8px 16px', backgroundColor: '#0066ff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                {loading ? 'Actualizando...' : '🔄 Actualizar Precios'}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
              {productosFiltrados.map(prod => {
                const precios = calcularPrecio(prod.costo);
                const enStock = prod.costo > 0;
                
                return (
                  <div key={prod.id} style={{ 
                    backgroundColor: 'white', 
                    padding: '16px', 
                    borderRadius: '8px', 
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    opacity: enStock ? 1 : 0.6
                  }}>
                    <div style={{ fontSize: '14px', color: '#666' }}>{prod.categoria}</div>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>{prod.modelo}</div>
                    <div style={{ fontSize: '12px', color: '#999', marginBottom: '12px' }}>{prod.descripcion}</div>
                    
                    {!enStock ? (
                      <div style={{ backgroundColor: '#ffe6e6', color: '#cc0000', padding: '8px', borderRadius: '4px', fontSize: '12px', textAlign: 'center', marginBottom: '8px' }}>
                        Sin Stock - Consultar
                      </div>
                    ) : (
                      <>
                        <div style={{ backgroundColor: '#f0f0f0', padding: '12px', borderRadius: '4px', marginBottom: '12px' }}>
                          <div style={{ fontSize: '12px', color: '#666' }}>Precio de Lista</div>
                          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#0066ff' }}>${precios.precioLista.toFixed(0)}</div>
                          <div style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>Precio de Contado (10% desc.)</div>
                          <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#00aa44' }}>${precios.precioContado.toFixed(0)}</div>
                        </div>
                        <button onClick={() => agregarAlPresupuesto(prod)}
                          style={{ width: '100%', padding: '8px', backgroundColor: '#0066ff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                          ➕ Agregar al Presupuesto
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB: GENERADOR DE PRESUPUESTOS */}
        {tab === 'presupuestos' && (
          <div>
            <h2>🛒 Generador de Presupuestos</h2>

            <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '8px', marginBottom: '24px' }}>
              <h3>Datos del Cliente</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <input type="text" placeholder="Nombre del cliente" value={clientData.nombre}
                  onChange={(e) => setClientData({ ...clientData, nombre: e.target.value })}
                  style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                <input type="text" placeholder="Empresa" value={clientData.empresa}
                  onChange={(e) => setClientData({ ...clientData, empresa: e.target.value })}
                  style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                <input type="text" placeholder="Teléfono" value={clientData.telefono}
                  onChange={(e) => setClientData({ ...clientData, telefono: e.target.value })}
                  style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                <input type="email" placeholder="Email" value={clientData.email}
                  onChange={(e) => setClientData({ ...clientData, email: e.target.value })}
                  style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
              </div>
            </div>

            <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '8px', marginBottom: '24px' }}>
              <h3>Productos en el Presupuesto</h3>
              {presupuesto.length === 0 ? (
                <p style={{ color: '#999' }}>No hay productos. Agregalos desde la lista de precios.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f0f0f0' }}>
                        <th style={{ textAlign: 'left', padding: '12px', borderBottom: '1px solid #ccc' }}>Modelo</th>
                        <th style={{ textAlign: 'left', padding: '12px', borderBottom: '1px solid #ccc' }}>Descripción</th>
                        <th style={{ textAlign: 'center', padding: '12px', borderBottom: '1px solid #ccc' }}>Cantidad</th>
                        <th style={{ textAlign: 'right', padding: '12px', borderBottom: '1px solid #ccc' }}>Precio Unitario</th>
                        <th style={{ textAlign: 'right', padding: '12px', borderBottom: '1px solid #ccc' }}>Total</th>
                        <th style={{ textAlign: 'center', padding: '12px', borderBottom: '1px solid #ccc' }}>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {presupuesto.map((item, idx) => {
                        const precio = item.tipoPrecio === 'lista' ? item.precioLista : item.precioContado;
                        const total = precio * item.cantidad;
                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '12px' }}>{item.modelo}</td>
                            <td style={{ padding: '12px' }}>{item.descripcion.substring(0, 30)}</td>
                            <td style={{ padding: '12px', textAlign: 'center' }}>
                              <input type="number" value={item.cantidad} min="1"
                                onChange={(e) => {
                                  const newPresupuesto = [...presupuesto];
                                  newPresupuesto[idx].cantidad = Number(e.target.value);
                                  setPresupuesto(newPresupuesto);
                                }}
                                style={{ width: '60px', padding: '4px', borderRadius: '4px', border: '1px solid #ccc' }} />
                            </td>
                            <td style={{ padding: '12px', textAlign: 'right' }}>${precio.toFixed(0)}</td>
                            <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>${total.toFixed(0)}</td>
                            <td style={{ padding: '12px', textAlign: 'center' }}>
                              <button onClick={() => setPresupuesto(presupuesto.filter((_, i) => i !== idx))}
                                style={{ background: 'none', border: 'none', color: '#cc0000', cursor: 'pointer' }}>
                                🗑️
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '8px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={generarPDF} disabled={presupuesto.length === 0}
                style={{ padding: '12px 24px', backgroundColor: '#00aa44', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                👁️ Vista Previa
              </button>
              <button onClick={descargarPDF} disabled={presupuesto.length === 0}
                style={{ padding: '12px 24px', backgroundColor: '#0066ff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                ⬇️ Descargar PDF
              </button>
            </div>
          </div>
        )}

        {/* TAB: CONFIGURACIÓN */}
        {tab === 'config' && (
          <div>
            <h2>⚙️ Configuración de TecniPro</h2>
            <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '8px', maxWidth: '600px' }}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>Email:</label>
                <input type="email" value={config.email} onChange={(e) => actualizarConfig('email', e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>Teléfono:</label>
                <input type="tel" value={config.telefono} onChange={(e) => actualizarConfig('telefono', e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>Dirección:</label>
                <input type="text" value={config.direccion} onChange={(e) => actualizarConfig('direccion', e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>Sitio Web:</label>
                <input type="url" value={config.sitioWeb} onChange={(e) => actualizarConfig('sitioWeb', e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>Margen por defecto (%):</label>
                <input type="number" value={config.margenDefault} onChange={(e) => actualizarConfig('margenDefault', Number(e.target.value))}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
              </div>

              <div style={{ borderTop: '1px solid #eee', paddingTop: '20px', marginTop: '20px' }}>
                <h3>Información</h3>
                <p style={{ fontSize: '12px', color: '#666', marginBottom: '12px' }}>
                  ✅ La lista de precios se carga automático desde el proveedor.
                </p>
                <p style={{ fontSize: '12px', color: '#666', marginBottom: '12px' }}>
                  📁 Cuando guardes presupuestos, se guardarán en tu Google Drive (tecniproapp@gmail.com).
                </p>
                <p style={{ fontSize: '12px', color: '#999' }}>
                  No necesitás configurar nada ahora. ¡La app está lista para usar! 🚀
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TecniProPresupuestos;