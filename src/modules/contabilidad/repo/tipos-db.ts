
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.18'
  }
  "contabilidad": {
          Tables: {
            "archivos_drive": {
                  Row: {
                    "actualizado_en": string,"anio_carpeta": number | null,"creado_en": string,"drive_file_id": string,"drive_url": string | null,"error_codigo": string | null,"estado": string,"factura_id": number | null,"id": number,"intentos": number,"md5": string | null,"md5_procesado": string | null,"mes_carpeta": number | null,"mime": string,"modificado_drive": string | null,"nombre": string,"reintentar_desde": string | null,"ruta": string,"tamano_bytes": number | null,"ultimo_error": string | null,"visto_en": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actualizado_en"?: string,"anio_carpeta"?: number | null,"creado_en"?: string,"drive_file_id": string,"drive_url"?: string | null,"error_codigo"?: string | null,"estado"?: string,"factura_id"?: number | null,"id"?: never,"intentos"?: number,"md5"?: string | null,"md5_procesado"?: string | null,"mes_carpeta"?: number | null,"mime": string,"modificado_drive"?: string | null,"nombre": string,"reintentar_desde"?: string | null,"ruta"?: string,"tamano_bytes"?: number | null,"ultimo_error"?: string | null,"visto_en"?: string
                  }
                  Update: {
                    "actualizado_en"?: string,"anio_carpeta"?: number | null,"creado_en"?: string,"drive_file_id"?: string,"drive_url"?: string | null,"error_codigo"?: string | null,"estado"?: string,"factura_id"?: number | null,"id"?: never,"intentos"?: number,"md5"?: string | null,"md5_procesado"?: string | null,"mes_carpeta"?: number | null,"mime"?: string,"modificado_drive"?: string | null,"nombre"?: string,"reintentar_desde"?: string | null,"ruta"?: string,"tamano_bytes"?: number | null,"ultimo_error"?: string | null,"visto_en"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "archivos_drive_factura_fk"
      columns: ["factura_id"]
isOneToOne: false
      referencedRelation: "facturas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "archivos_drive_factura_fk"
      columns: ["factura_id"]
isOneToOne: false
      referencedRelation: "v_cuentas_por_cobrar"
      referencedColumns: ["factura_id"]
    },{
      foreignKeyName: "archivos_drive_factura_fk"
      columns: ["factura_id"]
isOneToOne: false
      referencedRelation: "v_cuentas_por_pagar"
      referencedColumns: ["factura_id"]
    }
                  ]
                },"asiento_lineas": {
                  Row: {
                    "asiento_id": number,"credito": number,"cuenta_id": number,"debito": number,"descripcion": string | null,"id": number,"tercero_id": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "asiento_id": number,"credito"?: number,"cuenta_id": number,"debito"?: number,"descripcion"?: string | null,"id"?: never,"tercero_id"?: number | null
                  }
                  Update: {
                    "asiento_id"?: number,"credito"?: number,"cuenta_id"?: number,"debito"?: number,"descripcion"?: string | null,"id"?: never,"tercero_id"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "asiento_lineas_asiento_id_fkey"
      columns: ["asiento_id"]
isOneToOne: false
      referencedRelation: "asientos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "asiento_lineas_cuenta_id_fkey"
      columns: ["cuenta_id"]
isOneToOne: false
      referencedRelation: "cuentas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "asiento_lineas_cuenta_id_fkey"
      columns: ["cuenta_id"]
isOneToOne: false
      referencedRelation: "v_balance_comprobacion_mensual"
      referencedColumns: ["cuenta_id"]
    },{
      foreignKeyName: "asiento_lineas_tercero_id_fkey"
      columns: ["tercero_id"]
isOneToOne: false
      referencedRelation: "terceros"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "asiento_lineas_tercero_id_fkey"
      columns: ["tercero_id"]
isOneToOne: false
      referencedRelation: "v_gastos_proveedor"
      referencedColumns: ["tercero_id"]
    }
                  ]
                },"asientos": {
                  Row: {
                    "creado_en": string,"creado_por": string | null,"descripcion": string,"factura_id": number | null,"fecha": string,"id": number,"origen": string
                  }
                  ComputedFields: never
                  Insert: {
                    "creado_en"?: string,"creado_por"?: string | null,"descripcion": string,"factura_id"?: number | null,"fecha": string,"id"?: never,"origen"?: string
                  }
                  Update: {
                    "creado_en"?: string,"creado_por"?: string | null,"descripcion"?: string,"factura_id"?: number | null,"fecha"?: string,"id"?: never,"origen"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "asientos_factura_id_fkey"
      columns: ["factura_id"]
isOneToOne: true
      referencedRelation: "facturas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "asientos_factura_id_fkey"
      columns: ["factura_id"]
isOneToOne: true
      referencedRelation: "v_cuentas_por_cobrar"
      referencedColumns: ["factura_id"]
    },{
      foreignKeyName: "asientos_factura_id_fkey"
      columns: ["factura_id"]
isOneToOne: true
      referencedRelation: "v_cuentas_por_pagar"
      referencedColumns: ["factura_id"]
    }
                  ]
                },"categorias": {
                  Row: {
                    "activa": boolean,"creado_en": string,"cuenta_id": number,"cuenta_retefuente_id": number | null,"descripcion": string | null,"id": number,"nombre": string,"tipo_factura": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activa"?: boolean,"creado_en"?: string,"cuenta_id": number,"cuenta_retefuente_id"?: number | null,"descripcion"?: string | null,"id"?: never,"nombre": string,"tipo_factura": string
                  }
                  Update: {
                    "activa"?: boolean,"creado_en"?: string,"cuenta_id"?: number,"cuenta_retefuente_id"?: number | null,"descripcion"?: string | null,"id"?: never,"nombre"?: string,"tipo_factura"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "categorias_cuenta_id_fkey"
      columns: ["cuenta_id"]
isOneToOne: false
      referencedRelation: "cuentas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "categorias_cuenta_id_fkey"
      columns: ["cuenta_id"]
isOneToOne: false
      referencedRelation: "v_balance_comprobacion_mensual"
      referencedColumns: ["cuenta_id"]
    },{
      foreignKeyName: "categorias_cuenta_retefuente_id_fkey"
      columns: ["cuenta_retefuente_id"]
isOneToOne: false
      referencedRelation: "cuentas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "categorias_cuenta_retefuente_id_fkey"
      columns: ["cuenta_retefuente_id"]
isOneToOne: false
      referencedRelation: "v_balance_comprobacion_mensual"
      referencedColumns: ["cuenta_id"]
    }
                  ]
                },"configuracion": {
                  Row: {
                    "actualizado_en": string,"clave": string,"descripcion": string | null,"valor": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "actualizado_en"?: string,"clave": string,"descripcion"?: string | null,"valor": NonNullable<Json>
                  }
                  Update: {
                    "actualizado_en"?: string,"clave"?: string,"descripcion"?: string | null,"valor"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"cuentas": {
                  Row: {
                    "acepta_movimiento": boolean,"activa": boolean,"codigo": string,"creado_en": string,"id": number,"naturaleza": string,"nombre": string,"padre_id": number | null,"tipo": string
                  }
                  ComputedFields: never
                  Insert: {
                    "acepta_movimiento"?: boolean,"activa"?: boolean,"codigo": string,"creado_en"?: string,"id"?: never,"naturaleza": string,"nombre": string,"padre_id"?: number | null,"tipo": string
                  }
                  Update: {
                    "acepta_movimiento"?: boolean,"activa"?: boolean,"codigo"?: string,"creado_en"?: string,"id"?: never,"naturaleza"?: string,"nombre"?: string,"padre_id"?: number | null,"tipo"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cuentas_padre_id_fkey"
      columns: ["padre_id"]
isOneToOne: false
      referencedRelation: "cuentas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cuentas_padre_id_fkey"
      columns: ["padre_id"]
isOneToOne: false
      referencedRelation: "v_balance_comprobacion_mensual"
      referencedColumns: ["cuenta_id"]
    }
                  ]
                },"factura_items": {
                  Row: {
                    "cantidad": number | null,"descripcion": string,"factura_id": number,"id": number,"iva_tasa": number | null,"iva_valor": number | null,"linea": number,"total": number | null,"valor_unitario": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cantidad"?: number | null,"descripcion": string,"factura_id": number,"id"?: never,"iva_tasa"?: number | null,"iva_valor"?: number | null,"linea": number,"total"?: number | null,"valor_unitario"?: number | null
                  }
                  Update: {
                    "cantidad"?: number | null,"descripcion"?: string,"factura_id"?: number,"id"?: never,"iva_tasa"?: number | null,"iva_valor"?: number | null,"linea"?: number,"total"?: number | null,"valor_unitario"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "factura_items_factura_id_fkey"
      columns: ["factura_id"]
isOneToOne: false
      referencedRelation: "facturas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "factura_items_factura_id_fkey"
      columns: ["factura_id"]
isOneToOne: false
      referencedRelation: "v_cuentas_por_cobrar"
      referencedColumns: ["factura_id"]
    },{
      foreignKeyName: "factura_items_factura_id_fkey"
      columns: ["factura_id"]
isOneToOne: false
      referencedRelation: "v_cuentas_por_pagar"
      referencedColumns: ["factura_id"]
    }
                  ]
                },"facturas": {
                  Row: {
                    "actualizado_en": string,"aprobada_en": string | null,"aprobada_por": string | null,"archivo_id": number | null,"carpeta_origen": string | null,"categoria_id": number | null,"clase_documento": string,"componentes": NonNullable<Json>,"confianza": number | null,"confianza_campos": NonNullable<Json>,"creado_en": string,"cuenta_id": number | null,"cufe": string | null,"datos_ia": Json | null,"drive_file_id": string | null,"drive_md5": string | null,"drive_url": string | null,"estado": string,"fecha_emision": string | null,"fecha_vencimiento": string | null,"hallazgos": NonNullable<Json>,"id": number,"iva": number,"iva_tasa": number | null,"moneda": string,"numero": string | null,"observaciones": string | null,"otros_impuestos": number,"retefuente": number,"reteica": number,"subtotal": number | null,"tasa_cambio": number,"tercero_id": number | null,"tipo": string | null,"tipo_documento": string | null,"total": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "actualizado_en"?: string,"aprobada_en"?: string | null,"aprobada_por"?: string | null,"archivo_id"?: number | null,"carpeta_origen"?: string | null,"categoria_id"?: number | null,"clase_documento"?: string,"componentes"?: NonNullable<Json>,"confianza"?: number | null,"confianza_campos"?: NonNullable<Json>,"creado_en"?: string,"cuenta_id"?: number | null,"cufe"?: string | null,"datos_ia"?: Json | null,"drive_file_id"?: string | null,"drive_md5"?: string | null,"drive_url"?: string | null,"estado"?: string,"fecha_emision"?: string | null,"fecha_vencimiento"?: string | null,"hallazgos"?: NonNullable<Json>,"id"?: never,"iva"?: number,"iva_tasa"?: number | null,"moneda"?: string,"numero"?: string | null,"observaciones"?: string | null,"otros_impuestos"?: number,"retefuente"?: number,"reteica"?: number,"subtotal"?: number | null,"tasa_cambio"?: number,"tercero_id"?: number | null,"tipo"?: string | null,"tipo_documento"?: string | null,"total"?: number | null
                  }
                  Update: {
                    "actualizado_en"?: string,"aprobada_en"?: string | null,"aprobada_por"?: string | null,"archivo_id"?: number | null,"carpeta_origen"?: string | null,"categoria_id"?: number | null,"clase_documento"?: string,"componentes"?: NonNullable<Json>,"confianza"?: number | null,"confianza_campos"?: NonNullable<Json>,"creado_en"?: string,"cuenta_id"?: number | null,"cufe"?: string | null,"datos_ia"?: Json | null,"drive_file_id"?: string | null,"drive_md5"?: string | null,"drive_url"?: string | null,"estado"?: string,"fecha_emision"?: string | null,"fecha_vencimiento"?: string | null,"hallazgos"?: NonNullable<Json>,"id"?: never,"iva"?: number,"iva_tasa"?: number | null,"moneda"?: string,"numero"?: string | null,"observaciones"?: string | null,"otros_impuestos"?: number,"retefuente"?: number,"reteica"?: number,"subtotal"?: number | null,"tasa_cambio"?: number,"tercero_id"?: number | null,"tipo"?: string | null,"tipo_documento"?: string | null,"total"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "facturas_archivo_id_fkey"
      columns: ["archivo_id"]
isOneToOne: false
      referencedRelation: "archivos_drive"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "facturas_categoria_id_fkey"
      columns: ["categoria_id"]
isOneToOne: false
      referencedRelation: "categorias"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "facturas_categoria_id_fkey"
      columns: ["categoria_id"]
isOneToOne: false
      referencedRelation: "v_gastos_categoria"
      referencedColumns: ["categoria_id"]
    },{
      foreignKeyName: "facturas_cuenta_id_fkey"
      columns: ["cuenta_id"]
isOneToOne: false
      referencedRelation: "cuentas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "facturas_cuenta_id_fkey"
      columns: ["cuenta_id"]
isOneToOne: false
      referencedRelation: "v_balance_comprobacion_mensual"
      referencedColumns: ["cuenta_id"]
    },{
      foreignKeyName: "facturas_tercero_id_fkey"
      columns: ["tercero_id"]
isOneToOne: false
      referencedRelation: "terceros"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "facturas_tercero_id_fkey"
      columns: ["tercero_id"]
isOneToOne: false
      referencedRelation: "v_gastos_proveedor"
      referencedColumns: ["tercero_id"]
    }
                  ]
                },"procesamientos": {
                  Row: {
                    "archivo_id": number | null,"costo_usd": number | null,"creado_en": string,"duracion_ms": number | null,"error": string | null,"error_codigo": string | null,"estado": string,"factura_id": number | null,"id": number,"metodo": string | null,"modelo": string | null,"reintentable": boolean | null,"tokens_entrada": number | null,"tokens_salida": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "archivo_id"?: number | null,"costo_usd"?: number | null,"creado_en"?: string,"duracion_ms"?: number | null,"error"?: string | null,"error_codigo"?: string | null,"estado": string,"factura_id"?: number | null,"id"?: never,"metodo"?: string | null,"modelo"?: string | null,"reintentable"?: boolean | null,"tokens_entrada"?: number | null,"tokens_salida"?: number | null
                  }
                  Update: {
                    "archivo_id"?: number | null,"costo_usd"?: number | null,"creado_en"?: string,"duracion_ms"?: number | null,"error"?: string | null,"error_codigo"?: string | null,"estado"?: string,"factura_id"?: number | null,"id"?: never,"metodo"?: string | null,"modelo"?: string | null,"reintentable"?: boolean | null,"tokens_entrada"?: number | null,"tokens_salida"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "procesamientos_archivo_id_fkey"
      columns: ["archivo_id"]
isOneToOne: false
      referencedRelation: "archivos_drive"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "procesamientos_factura_id_fkey"
      columns: ["factura_id"]
isOneToOne: false
      referencedRelation: "facturas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "procesamientos_factura_id_fkey"
      columns: ["factura_id"]
isOneToOne: false
      referencedRelation: "v_cuentas_por_cobrar"
      referencedColumns: ["factura_id"]
    },{
      foreignKeyName: "procesamientos_factura_id_fkey"
      columns: ["factura_id"]
isOneToOne: false
      referencedRelation: "v_cuentas_por_pagar"
      referencedColumns: ["factura_id"]
    }
                  ]
                },"revisiones": {
                  Row: {
                    "campo": string,"creado_en": string,"factura_id": number,"id": number,"usuario": string | null,"valor_corregido": Json | null,"valor_ia": Json | null
                  }
                  ComputedFields: never
                  Insert: {
                    "campo": string,"creado_en"?: string,"factura_id": number,"id"?: never,"usuario"?: string | null,"valor_corregido"?: Json | null,"valor_ia"?: Json | null
                  }
                  Update: {
                    "campo"?: string,"creado_en"?: string,"factura_id"?: number,"id"?: never,"usuario"?: string | null,"valor_corregido"?: Json | null,"valor_ia"?: Json | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "revisiones_factura_id_fkey"
      columns: ["factura_id"]
isOneToOne: false
      referencedRelation: "facturas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "revisiones_factura_id_fkey"
      columns: ["factura_id"]
isOneToOne: false
      referencedRelation: "v_cuentas_por_cobrar"
      referencedColumns: ["factura_id"]
    },{
      foreignKeyName: "revisiones_factura_id_fkey"
      columns: ["factura_id"]
isOneToOne: false
      referencedRelation: "v_cuentas_por_pagar"
      referencedColumns: ["factura_id"]
    }
                  ]
                },"saldos_iniciales": {
                  Row: {
                    "creado_en": string,"credito": number,"cuenta_id": number,"debito": number,"fecha_corte": string,"id": number,"tercero_id": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "creado_en"?: string,"credito"?: number,"cuenta_id": number,"debito"?: number,"fecha_corte": string,"id"?: never,"tercero_id"?: number | null
                  }
                  Update: {
                    "creado_en"?: string,"credito"?: number,"cuenta_id"?: number,"debito"?: number,"fecha_corte"?: string,"id"?: never,"tercero_id"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "saldos_iniciales_cuenta_id_fkey"
      columns: ["cuenta_id"]
isOneToOne: false
      referencedRelation: "cuentas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "saldos_iniciales_cuenta_id_fkey"
      columns: ["cuenta_id"]
isOneToOne: false
      referencedRelation: "v_balance_comprobacion_mensual"
      referencedColumns: ["cuenta_id"]
    },{
      foreignKeyName: "saldos_iniciales_tercero_id_fkey"
      columns: ["tercero_id"]
isOneToOne: false
      referencedRelation: "terceros"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "saldos_iniciales_tercero_id_fkey"
      columns: ["tercero_id"]
isOneToOne: false
      referencedRelation: "v_gastos_proveedor"
      referencedColumns: ["tercero_id"]
    }
                  ]
                },"tasas_cambio": {
                  Row: {
                    "creado_en": string,"fecha": string,"fuente": string,"moneda": string,"valor": number
                  }
                  ComputedFields: never
                  Insert: {
                    "creado_en"?: string,"fecha": string,"fuente"?: string,"moneda": string,"valor": number
                  }
                  Update: {
                    "creado_en"?: string,"fecha"?: string,"fuente"?: string,"moneda"?: string,"valor"?: number
                  }
                  Relationships: [
                    
                  ]
                },"terceros": {
                  Row: {
                    "actualizado_en": string,"creado_en": string,"dv": string | null,"id": number,"nit": string,"pais": string,"razon_social": string,"tipo": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actualizado_en"?: string,"creado_en"?: string,"dv"?: string | null,"id"?: never,"nit": string,"pais"?: string,"razon_social": string,"tipo"?: string
                  }
                  Update: {
                    "actualizado_en"?: string,"creado_en"?: string,"dv"?: string | null,"id"?: never,"nit"?: string,"pais"?: string,"razon_social"?: string,"tipo"?: string
                  }
                  Relationships: [
                    
                  ]
                },"usuarios": {
                  Row: {
                    "activo": boolean,"creado_en": string,"email": string,"nombre": string | null,"rol": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"creado_en"?: string,"email": string,"nombre"?: string | null,"rol"?: string
                  }
                  Update: {
                    "activo"?: boolean,"creado_en"?: string,"email"?: string,"nombre"?: string | null,"rol"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "v_balance_comprobacion_mensual": {
                  Row: {
                    "creditos": number | null,"cuenta_codigo": string,"cuenta_id": number,"cuenta_nombre": string,"debitos": number | null,"movimiento": number | null,"naturaleza": string,"periodo": string | null,"tipo": string
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"v_consumo_ia_mensual": {
                  Row: {
                    "costo_usd_estimado": number | null,"errores": number | null,"errores_sin_creditos": number | null,"exitos": number | null,"intentos": number | null,"modelo": string | null,"periodo": string | null,"tokens_entrada": number | null,"tokens_promedio_por_factura": number | null,"tokens_salida": number | null,"tokens_total": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"v_cuentas_por_cobrar": {
                  Row: {
                    "dias_vencida": number | null,"factura_id": number,"fecha_emision": string | null,"fecha_vencimiento": string | null,"moneda": string,"nit": string,"numero": string | null,"razon_social": string,"saldo_cop": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"v_cuentas_por_pagar": {
                  Row: {
                    "dias_vencida": number | null,"factura_id": number,"fecha_emision": string | null,"fecha_vencimiento": string | null,"moneda": string,"nit": string,"numero": string | null,"razon_social": string,"saldo_cop": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"v_estado_archivos": {
                  Row: {
                    "cantidad": number | null,"error_codigo": string | null,"estado": string
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"v_estado_resultados": {
                  Row: {
                    "anio": number | null,"cuenta_codigo": string,"cuenta_nombre": string,"periodo": string | null,"tipo": string,"valor": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"v_estado_saldos_iniciales": {
                  Row: {
                    "cantidad": number | null,"cargados": boolean | null,"cuadran": boolean | null,"fecha_corte": string | null,"total_creditos": number | null,"total_debitos": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"v_gastos_categoria": {
                  Row: {
                    "cantidad": number | null,"categoria": string | null,"categoria_id": number | null,"iva_cop": number | null,"periodo": string | null,"subtotal_cop": number | null,"tipo": string | null,"total_cop": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"v_gastos_proveedor": {
                  Row: {
                    "cantidad": number | null,"iva_cop": number | null,"nit": string,"periodo": string | null,"razon_social": string,"subtotal_cop": number | null,"tercero_id": number,"total_cop": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"v_impuestos_periodo": {
                  Row: {
                    "iva_descontable": number | null,"iva_generado": number | null,"iva_neto": number | null,"periodo": string | null,"retefuente_a_favor": number | null,"retefuente_practicada": number | null,"reteica_a_favor": number | null,"reteica_practicada": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"v_libro_mayor": {
                  Row: {
                    "asiento_id": number | null,"credito": number | null,"cuenta_codigo": string,"cuenta_nombre": string,"debito": number | null,"descripcion": string | null,"factura_id": number | null,"fecha": string | null,"naturaleza": string,"origen": string | null,"periodo": string | null,"saldo": number | null,"tercero_nit": string | null,"tercero_nombre": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"v_movimientos": {
                  Row: {
                    "asiento_id": number | null,"credito": number | null,"cuenta_id": number | null,"debito": number | null,"descripcion": string | null,"factura_id": number | null,"fecha": string | null,"linea_id": number | null,"origen": string | null,"tercero_id": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"v_resultado_anual": {
                  Row: {
                    "anio": number | null,"costos": number | null,"gastos": number | null,"ingresos": number | null,"utilidad": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"v_resultado_mensual": {
                  Row: {
                    "anio": number | null,"costos": number | null,"gastos": number | null,"ingresos": number | null,"periodo": string | null,"utilidad": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "balance_comprobacion":
{ Args: { "p_desde": string,"p_hasta": string }; Returns: {
              "creditos": number,"cuenta_codigo": string,"cuenta_nombre": string,"debitos": number,"naturaleza": string,"saldo_anterior": number,"saldo_final": number,"tipo": string
            }[]
                           },
"balance_general":
{ Args: { "p_fecha": string }; Returns: {
              "cuenta_codigo": string,"cuenta_nombre": string,"saldo": number,"seccion": string
            }[]
                           },
"cambiar_estado_factura":
{ Args: { "p_estado": string,"p_factura_id": number,"p_observaciones"?: string }; Returns: undefined
                           },
"es_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"puede_editar":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"puede_leer":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"registrar_asiento_factura":
{ Args: { "p_descripcion": string,"p_factura_id": number,"p_fecha": string,"p_lineas": Json,"p_usuario": string }; Returns: number
                           },
"reintentar_archivos":
{ Args: { "p_codigo"?: string }; Returns: number
                           },
"rol_actual":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"tomar_archivos_pendientes":
{ Args: { "p_limite": number }; Returns: {
              "actualizado_en": string,
"anio_carpeta": number | null,
"creado_en": string,
"drive_file_id": string,
"drive_url": string | null,
"error_codigo": string | null,
"estado": string,
"factura_id": number | null,
"id": number,
"intentos": number,
"md5": string | null,
"md5_procesado": string | null,
"mes_carpeta": number | null,
"mime": string,
"modificado_drive": string | null,
"nombre": string,
"reintentar_desde": string | null,
"ruta": string,
"tamano_bytes": number | null,
"ultimo_error": string | null,
"visto_en": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "archivos_drive"
        isOneToOne: false
        isSetofReturn: true
      } }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "contabilidad">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "contabilidad": {
          Enums: {
            
          }
        }
} as const
