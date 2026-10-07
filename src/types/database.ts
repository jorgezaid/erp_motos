
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "batch_items": {
                  Row: {
                    "batch_id": string,"cantidad_dam": number | null,"cantidad_packing_list": number,"cbm_total": number | null,"created_at": string,"exw_total_usd": number | null,"exw_usd_unitario": number,"id": string,"model_id": string,"volumen_cbm_unitario": number
                  }
                  Insert: {
                    "batch_id": string,"cantidad_dam"?: number | null,"cantidad_packing_list": number,"cbm_total"?: never,"created_at"?: string,"exw_total_usd"?: never,"exw_usd_unitario": number,"id"?: string,"model_id": string,"volumen_cbm_unitario": number
                  }
                  Update: {
                    "batch_id"?: string,"cantidad_dam"?: number | null,"cantidad_packing_list"?: number,"cbm_total"?: never,"created_at"?: string,"exw_total_usd"?: never,"exw_usd_unitario"?: number,"id"?: string,"model_id"?: string,"volumen_cbm_unitario"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "batch_items_batch_id_fkey"
      columns: ["batch_id"]
isOneToOne: false
      referencedRelation: "import_batches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "batch_items_batch_id_fkey"
      columns: ["batch_id"]
isOneToOne: false
      referencedRelation: "v_batch_reconciliation"
      referencedColumns: ["batch_id"]
    },{
      foreignKeyName: "batch_items_batch_id_fkey"
      columns: ["batch_id"]
isOneToOne: false
      referencedRelation: "v_price_matrix"
      referencedColumns: ["batch_id"]
    },{
      foreignKeyName: "batch_items_model_id_fkey"
      columns: ["model_id"]
isOneToOne: false
      referencedRelation: "v_price_matrix"
      referencedColumns: ["model_id"]
    },{
      foreignKeyName: "batch_items_model_id_fkey"
      columns: ["model_id"]
isOneToOne: false
      referencedRelation: "vehicle_models"
      referencedColumns: ["id"]
    }
                  ]
                },"batch_model_costs": {
                  Row: {
                    "alquiler_asignado_pen": number,"armado_pen": number,"batch_id": string,"calculado_at": string,"calculado_por": string | null,"cantidad": number,"costo_landing_unitario_pen": number | null,"costo_total_pen": number | null,"flete_internacional_asignado_usd": number,"flete_nacional_asignado_pen": number,"fob_asignado_usd": number,"gastos_agente_asignado_usd": number,"impuestos_asignados_pen": number,"model_id": string,"publicidad_asignada_pen": number,"sueldos_asignado_pen": number,"tipo_cambio": number
                  }
                  Insert: {
                    "alquiler_asignado_pen"?: number,"armado_pen"?: number,"batch_id": string,"calculado_at"?: string,"calculado_por"?: string | null,"cantidad": number,"costo_landing_unitario_pen"?: never,"costo_total_pen"?: never,"flete_internacional_asignado_usd"?: number,"flete_nacional_asignado_pen"?: number,"fob_asignado_usd"?: number,"gastos_agente_asignado_usd"?: number,"impuestos_asignados_pen"?: number,"model_id": string,"publicidad_asignada_pen"?: number,"sueldos_asignado_pen"?: number,"tipo_cambio": number
                  }
                  Update: {
                    "alquiler_asignado_pen"?: number,"armado_pen"?: number,"batch_id"?: string,"calculado_at"?: string,"calculado_por"?: string | null,"cantidad"?: number,"costo_landing_unitario_pen"?: never,"costo_total_pen"?: never,"flete_internacional_asignado_usd"?: number,"flete_nacional_asignado_pen"?: number,"fob_asignado_usd"?: number,"gastos_agente_asignado_usd"?: number,"impuestos_asignados_pen"?: number,"model_id"?: string,"publicidad_asignada_pen"?: number,"sueldos_asignado_pen"?: number,"tipo_cambio"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "batch_model_costs_batch_id_fkey"
      columns: ["batch_id"]
isOneToOne: false
      referencedRelation: "import_batches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "batch_model_costs_batch_id_fkey"
      columns: ["batch_id"]
isOneToOne: false
      referencedRelation: "v_batch_reconciliation"
      referencedColumns: ["batch_id"]
    },{
      foreignKeyName: "batch_model_costs_batch_id_fkey"
      columns: ["batch_id"]
isOneToOne: false
      referencedRelation: "v_price_matrix"
      referencedColumns: ["batch_id"]
    },{
      foreignKeyName: "batch_model_costs_batch_id_model_id_fkey"
      columns: ["batch_id","model_id"]
isOneToOne: true
      referencedRelation: "batch_items"
      referencedColumns: ["batch_id","model_id"]
    },{
      foreignKeyName: "batch_model_costs_calculado_por_fkey"
      columns: ["calculado_por"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "batch_model_costs_model_id_fkey"
      columns: ["model_id"]
isOneToOne: false
      referencedRelation: "v_price_matrix"
      referencedColumns: ["model_id"]
    },{
      foreignKeyName: "batch_model_costs_model_id_fkey"
      columns: ["model_id"]
isOneToOne: false
      referencedRelation: "vehicle_models"
      referencedColumns: ["id"]
    }
                  ]
                },"import_batches": {
                  Row: {
                    "ad_valorem_pen": number,"alquiler_periodo_pen": number,"codigo_embarque": string,"costo_armado_unitario_pen": number,"created_at": string,"estado": Database["public"]['Enums']["batch_status"],"fecha_embarque": string | null,"fecha_llegada": string | null,"flete_internacional_usd": number,"flete_nacional_pen": number,"fob_total_usd": number,"gastos_agente_usd": number,"gastos_operativos_fijos_pen": number | null,"id": string,"igv_pen": number,"impuestos_asignables_pen": number | null,"impuestos_recuperables_al_costo": boolean,"impuestos_sunat_pen": number | null,"ipm_pen": number,"liquidado_at": string | null,"liquidado_por": string | null,"notas": string | null,"nro_dam": string | null,"percepcion_pen": number,"proveedor": string | null,"publicidad_inicial_pen": number,"sueldos_periodo_pen": number,"tipo_cambio": number | null,"updated_at": string
                  }
                  Insert: {
                    "ad_valorem_pen"?: number,"alquiler_periodo_pen"?: number,"codigo_embarque": string,"costo_armado_unitario_pen"?: number,"created_at"?: string,"estado"?: Database["public"]['Enums']["batch_status"],"fecha_embarque"?: string | null,"fecha_llegada"?: string | null,"flete_internacional_usd"?: number,"flete_nacional_pen"?: number,"fob_total_usd"?: number,"gastos_agente_usd"?: number,"gastos_operativos_fijos_pen"?: never,"id"?: string,"igv_pen"?: number,"impuestos_asignables_pen"?: never,"impuestos_recuperables_al_costo"?: boolean,"impuestos_sunat_pen"?: never,"ipm_pen"?: number,"liquidado_at"?: string | null,"liquidado_por"?: string | null,"notas"?: string | null,"nro_dam"?: string | null,"percepcion_pen"?: number,"proveedor"?: string | null,"publicidad_inicial_pen"?: number,"sueldos_periodo_pen"?: number,"tipo_cambio"?: number | null,"updated_at"?: string
                  }
                  Update: {
                    "ad_valorem_pen"?: number,"alquiler_periodo_pen"?: number,"codigo_embarque"?: string,"costo_armado_unitario_pen"?: number,"created_at"?: string,"estado"?: Database["public"]['Enums']["batch_status"],"fecha_embarque"?: string | null,"fecha_llegada"?: string | null,"flete_internacional_usd"?: number,"flete_nacional_pen"?: number,"fob_total_usd"?: number,"gastos_agente_usd"?: number,"gastos_operativos_fijos_pen"?: never,"id"?: string,"igv_pen"?: number,"impuestos_asignables_pen"?: never,"impuestos_recuperables_al_costo"?: boolean,"impuestos_sunat_pen"?: never,"ipm_pen"?: number,"liquidado_at"?: string | null,"liquidado_por"?: string | null,"notas"?: string | null,"nro_dam"?: string | null,"percepcion_pen"?: number,"proveedor"?: string | null,"publicidad_inicial_pen"?: number,"sueldos_periodo_pen"?: number,"tipo_cambio"?: number | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "import_batches_liquidado_por_fkey"
      columns: ["liquidado_por"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"locations": {
                  Row: {
                    "activo": boolean,"created_at": string,"direccion": string | null,"id": string,"nombre": string,"tipo": Database["public"]['Enums']["location_type"]
                  }
                  Insert: {
                    "activo"?: boolean,"created_at"?: string,"direccion"?: string | null,"id"?: string,"nombre": string,"tipo": Database["public"]['Enums']["location_type"]
                  }
                  Update: {
                    "activo"?: boolean,"created_at"?: string,"direccion"?: string | null,"id"?: string,"nombre"?: string,"tipo"?: Database["public"]['Enums']["location_type"]
                  }
                  Relationships: [
                    
                  ]
                },"order_items": {
                  Row: {
                    "activo": boolean,"created_at": string,"id": string,"order_id": string,"precio_unitario_pen": number,"vehicle_id": string
                  }
                  Insert: {
                    "activo"?: boolean,"created_at"?: string,"id"?: string,"order_id": string,"precio_unitario_pen"?: number,"vehicle_id": string
                  }
                  Update: {
                    "activo"?: boolean,"created_at"?: string,"id"?: string,"order_id"?: string,"precio_unitario_pen"?: number,"vehicle_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_items_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "sales_orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "v_sales_margin"
      referencedColumns: ["order_id"]
    },{
      foreignKeyName: "order_items_vehicle_id_fkey"
      columns: ["vehicle_id"]
isOneToOne: false
      referencedRelation: "v_stock"
      referencedColumns: ["vehicle_id"]
    },{
      foreignKeyName: "order_items_vehicle_id_fkey"
      columns: ["vehicle_id"]
isOneToOne: false
      referencedRelation: "v_vehicle_costs"
      referencedColumns: ["vehicle_id"]
    },{
      foreignKeyName: "order_items_vehicle_id_fkey"
      columns: ["vehicle_id"]
isOneToOne: false
      referencedRelation: "vehicle_inventory"
      referencedColumns: ["id"]
    }
                  ]
                },"payments": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"metodo": Database["public"]['Enums']["payment_method"],"monto_pen": number,"order_id": string,"referencia": string | null
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"metodo": Database["public"]['Enums']["payment_method"],"monto_pen": number,"order_id": string,"referencia"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"metodo"?: Database["public"]['Enums']["payment_method"],"monto_pen"?: number,"order_id"?: string,"referencia"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "sales_orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "v_sales_margin"
      referencedColumns: ["order_id"]
    }
                  ]
                },"price_list": {
                  Row: {
                    "batch_id": string,"model_id": string,"precio_manual_pen": number | null,"precio_sugerido_pen": number,"precio_venta_pen": number | null,"tipo_venta": Database["public"]['Enums']["sale_type"],"updated_at": string
                  }
                  Insert: {
                    "batch_id": string,"model_id": string,"precio_manual_pen"?: number | null,"precio_sugerido_pen": number,"precio_venta_pen"?: never,"tipo_venta": Database["public"]['Enums']["sale_type"],"updated_at"?: string
                  }
                  Update: {
                    "batch_id"?: string,"model_id"?: string,"precio_manual_pen"?: number | null,"precio_sugerido_pen"?: number,"precio_venta_pen"?: never,"tipo_venta"?: Database["public"]['Enums']["sale_type"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "price_list_batch_id_fkey"
      columns: ["batch_id"]
isOneToOne: false
      referencedRelation: "import_batches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "price_list_batch_id_fkey"
      columns: ["batch_id"]
isOneToOne: false
      referencedRelation: "v_batch_reconciliation"
      referencedColumns: ["batch_id"]
    },{
      foreignKeyName: "price_list_batch_id_fkey"
      columns: ["batch_id"]
isOneToOne: false
      referencedRelation: "v_price_matrix"
      referencedColumns: ["batch_id"]
    },{
      foreignKeyName: "price_list_model_id_fkey"
      columns: ["model_id"]
isOneToOne: false
      referencedRelation: "v_price_matrix"
      referencedColumns: ["model_id"]
    },{
      foreignKeyName: "price_list_model_id_fkey"
      columns: ["model_id"]
isOneToOne: false
      referencedRelation: "vehicle_models"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "price_list_tipo_venta_fkey"
      columns: ["tipo_venta"]
isOneToOne: false
      referencedRelation: "price_margins"
      referencedColumns: ["tipo_venta"]
    }
                  ]
                },"price_margins": {
                  Row: {
                    "cantidad_minima": number,"margen_objetivo": number,"tipo_venta": Database["public"]['Enums']["sale_type"],"updated_at": string
                  }
                  Insert: {
                    "cantidad_minima": number,"margen_objetivo": number,"tipo_venta": Database["public"]['Enums']["sale_type"],"updated_at"?: string
                  }
                  Update: {
                    "cantidad_minima"?: number,"margen_objetivo"?: number,"tipo_venta"?: Database["public"]['Enums']["sale_type"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "activo": boolean,"created_at": string,"id": string,"nombre": string,"rol": Database["public"]['Enums']["app_role"] | null,"updated_at": string
                  }
                  Insert: {
                    "activo"?: boolean,"created_at"?: string,"id": string,"nombre"?: string,"rol"?: Database["public"]['Enums']["app_role"] | null,"updated_at"?: string
                  }
                  Update: {
                    "activo"?: boolean,"created_at"?: string,"id"?: string,"nombre"?: string,"rol"?: Database["public"]['Enums']["app_role"] | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"sales_orders": {
                  Row: {
                    "anulada_at": string | null,"cliente_documento": string,"cliente_email": string | null,"cliente_nombre": string,"cliente_telefono": string | null,"cliente_tipo_documento": Database["public"]['Enums']["document_type"],"confirmada_at": string | null,"created_at": string,"estado": Database["public"]['Enums']["order_status"],"id": string,"metodo_pago": Database["public"]['Enums']["payment_method"] | null,"motivo_anulacion": string | null,"numero": number,"tipo_venta": Database["public"]['Enums']["sale_type"],"total_pen": number,"updated_at": string,"vendedor_id": string | null
                  }
                  Insert: {
                    "anulada_at"?: string | null,"cliente_documento": string,"cliente_email"?: string | null,"cliente_nombre": string,"cliente_telefono"?: string | null,"cliente_tipo_documento": Database["public"]['Enums']["document_type"],"confirmada_at"?: string | null,"created_at"?: string,"estado"?: Database["public"]['Enums']["order_status"],"id"?: string,"metodo_pago"?: Database["public"]['Enums']["payment_method"] | null,"motivo_anulacion"?: string | null,"numero"?: never,"tipo_venta"?: Database["public"]['Enums']["sale_type"],"total_pen"?: number,"updated_at"?: string,"vendedor_id"?: string | null
                  }
                  Update: {
                    "anulada_at"?: string | null,"cliente_documento"?: string,"cliente_email"?: string | null,"cliente_nombre"?: string,"cliente_telefono"?: string | null,"cliente_tipo_documento"?: Database["public"]['Enums']["document_type"],"confirmada_at"?: string | null,"created_at"?: string,"estado"?: Database["public"]['Enums']["order_status"],"id"?: string,"metodo_pago"?: Database["public"]['Enums']["payment_method"] | null,"motivo_anulacion"?: string | null,"numero"?: never,"tipo_venta"?: Database["public"]['Enums']["sale_type"],"total_pen"?: number,"updated_at"?: string,"vendedor_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "sales_orders_vendedor_id_fkey"
      columns: ["vendedor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"technical_inspections": {
                  Row: {
                    "aprobada": boolean | null,"baterias_contadas": number,"baterias_esperadas": number,"checklist": NonNullable<Json>,"created_at": string,"id": string,"inspector_id": string | null,"motor_verificado": boolean,"observaciones": string | null,"vehicle_id": string,"vin_verificado": boolean,"voltaje_medido": number | null
                  }
                  Insert: {
                    "aprobada"?: never,"baterias_contadas": number,"baterias_esperadas": number,"checklist"?: NonNullable<Json>,"created_at"?: string,"id"?: string,"inspector_id"?: string | null,"motor_verificado"?: boolean,"observaciones"?: string | null,"vehicle_id": string,"vin_verificado"?: boolean,"voltaje_medido"?: number | null
                  }
                  Update: {
                    "aprobada"?: never,"baterias_contadas"?: number,"baterias_esperadas"?: number,"checklist"?: NonNullable<Json>,"created_at"?: string,"id"?: string,"inspector_id"?: string | null,"motor_verificado"?: boolean,"observaciones"?: string | null,"vehicle_id"?: string,"vin_verificado"?: boolean,"voltaje_medido"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "technical_inspections_inspector_id_fkey"
      columns: ["inspector_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "technical_inspections_vehicle_id_fkey"
      columns: ["vehicle_id"]
isOneToOne: false
      referencedRelation: "v_stock"
      referencedColumns: ["vehicle_id"]
    },{
      foreignKeyName: "technical_inspections_vehicle_id_fkey"
      columns: ["vehicle_id"]
isOneToOne: false
      referencedRelation: "v_vehicle_costs"
      referencedColumns: ["vehicle_id"]
    },{
      foreignKeyName: "technical_inspections_vehicle_id_fkey"
      columns: ["vehicle_id"]
isOneToOne: false
      referencedRelation: "vehicle_inventory"
      referencedColumns: ["id"]
    }
                  ]
                },"vehicle_batteries": {
                  Row: {
                    "created_at": string,"id": string,"posicion": number | null,"serial": string,"vehicle_id": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"posicion"?: number | null,"serial": string,"vehicle_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"posicion"?: number | null,"serial"?: string,"vehicle_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "vehicle_batteries_vehicle_id_fkey"
      columns: ["vehicle_id"]
isOneToOne: false
      referencedRelation: "v_stock"
      referencedColumns: ["vehicle_id"]
    },{
      foreignKeyName: "vehicle_batteries_vehicle_id_fkey"
      columns: ["vehicle_id"]
isOneToOne: false
      referencedRelation: "v_vehicle_costs"
      referencedColumns: ["vehicle_id"]
    },{
      foreignKeyName: "vehicle_batteries_vehicle_id_fkey"
      columns: ["vehicle_id"]
isOneToOne: false
      referencedRelation: "vehicle_inventory"
      referencedColumns: ["id"]
    }
                  ]
                },"vehicle_inventory": {
                  Row: {
                    "batch_id": string,"color_primario": string | null,"color_secundario": string | null,"created_at": string,"estado": Database["public"]['Enums']["vehicle_status"],"id": string,"location_id": string | null,"model_id": string,"notas": string | null,"nro_motor": string,"updated_at": string,"vin_chasis": string
                  }
                  Insert: {
                    "batch_id": string,"color_primario"?: string | null,"color_secundario"?: string | null,"created_at"?: string,"estado"?: Database["public"]['Enums']["vehicle_status"],"id"?: string,"location_id"?: string | null,"model_id": string,"notas"?: string | null,"nro_motor": string,"updated_at"?: string,"vin_chasis": string
                  }
                  Update: {
                    "batch_id"?: string,"color_primario"?: string | null,"color_secundario"?: string | null,"created_at"?: string,"estado"?: Database["public"]['Enums']["vehicle_status"],"id"?: string,"location_id"?: string | null,"model_id"?: string,"notas"?: string | null,"nro_motor"?: string,"updated_at"?: string,"vin_chasis"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "vehicle_inventory_batch_id_model_id_fkey"
      columns: ["batch_id","model_id"]
isOneToOne: false
      referencedRelation: "batch_items"
      referencedColumns: ["batch_id","model_id"]
    },{
      foreignKeyName: "vehicle_inventory_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "vehicle_inventory_model_id_fkey"
      columns: ["model_id"]
isOneToOne: false
      referencedRelation: "v_price_matrix"
      referencedColumns: ["model_id"]
    },{
      foreignKeyName: "vehicle_inventory_model_id_fkey"
      columns: ["model_id"]
isOneToOne: false
      referencedRelation: "vehicle_models"
      referencedColumns: ["id"]
    }
                  ]
                },"vehicle_models": {
                  Row: {
                    "activo": boolean,"amperaje_bateria_ah": number,"cantidad_baterias_12v": number | null,"categoria": Database["public"]['Enums']["vehicle_category"],"codigo_modelo": string,"created_at": string,"exw_usd_unitario": number,"garantia_baterias_meses": number,"garantia_meses": number,"id": string,"nombre_comercial": string | null,"potencia_motor_watts": number,"updated_at": string,"voltaje_sistema": number,"volumen_cbm_unitario": number
                  }
                  Insert: {
                    "activo"?: boolean,"amperaje_bateria_ah": number,"cantidad_baterias_12v"?: never,"categoria": Database["public"]['Enums']["vehicle_category"],"codigo_modelo": string,"created_at"?: string,"exw_usd_unitario": number,"garantia_baterias_meses"?: number,"garantia_meses"?: number,"id"?: string,"nombre_comercial"?: string | null,"potencia_motor_watts": number,"updated_at"?: string,"voltaje_sistema": number,"volumen_cbm_unitario": number
                  }
                  Update: {
                    "activo"?: boolean,"amperaje_bateria_ah"?: number,"cantidad_baterias_12v"?: never,"categoria"?: Database["public"]['Enums']["vehicle_category"],"codigo_modelo"?: string,"created_at"?: string,"exw_usd_unitario"?: number,"garantia_baterias_meses"?: number,"garantia_meses"?: number,"id"?: string,"nombre_comercial"?: string | null,"potencia_motor_watts"?: number,"updated_at"?: string,"voltaje_sistema"?: number,"volumen_cbm_unitario"?: number
                  }
                  Relationships: [
                    
                  ]
                },"vehicle_status_history": {
                  Row: {
                    "changed_at": string,"changed_by": string | null,"estado_anterior": Database["public"]['Enums']["vehicle_status"] | null,"estado_nuevo": Database["public"]['Enums']["vehicle_status"],"id": number,"location_id": string | null,"vehicle_id": string
                  }
                  Insert: {
                    "changed_at"?: string,"changed_by"?: string | null,"estado_anterior"?: Database["public"]['Enums']["vehicle_status"] | null,"estado_nuevo": Database["public"]['Enums']["vehicle_status"],"id"?: never,"location_id"?: string | null,"vehicle_id": string
                  }
                  Update: {
                    "changed_at"?: string,"changed_by"?: string | null,"estado_anterior"?: Database["public"]['Enums']["vehicle_status"] | null,"estado_nuevo"?: Database["public"]['Enums']["vehicle_status"],"id"?: never,"location_id"?: string | null,"vehicle_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "vehicle_status_history_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "vehicle_status_history_vehicle_id_fkey"
      columns: ["vehicle_id"]
isOneToOne: false
      referencedRelation: "v_stock"
      referencedColumns: ["vehicle_id"]
    },{
      foreignKeyName: "vehicle_status_history_vehicle_id_fkey"
      columns: ["vehicle_id"]
isOneToOne: false
      referencedRelation: "v_vehicle_costs"
      referencedColumns: ["vehicle_id"]
    },{
      foreignKeyName: "vehicle_status_history_vehicle_id_fkey"
      columns: ["vehicle_id"]
isOneToOne: false
      referencedRelation: "vehicle_inventory"
      referencedColumns: ["id"]
    }
                  ]
                },"warranties": {
                  Row: {
                    "anulada": boolean,"cobertura": Database["public"]['Enums']["warranty_coverage"],"created_at": string,"fecha_fin": string,"fecha_inicio": string,"id": string,"order_id": string,"vehicle_id": string
                  }
                  Insert: {
                    "anulada"?: boolean,"cobertura": Database["public"]['Enums']["warranty_coverage"],"created_at"?: string,"fecha_fin": string,"fecha_inicio": string,"id"?: string,"order_id": string,"vehicle_id": string
                  }
                  Update: {
                    "anulada"?: boolean,"cobertura"?: Database["public"]['Enums']["warranty_coverage"],"created_at"?: string,"fecha_fin"?: string,"fecha_inicio"?: string,"id"?: string,"order_id"?: string,"vehicle_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "warranties_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "sales_orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "warranties_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "v_sales_margin"
      referencedColumns: ["order_id"]
    },{
      foreignKeyName: "warranties_vehicle_id_fkey"
      columns: ["vehicle_id"]
isOneToOne: false
      referencedRelation: "v_stock"
      referencedColumns: ["vehicle_id"]
    },{
      foreignKeyName: "warranties_vehicle_id_fkey"
      columns: ["vehicle_id"]
isOneToOne: false
      referencedRelation: "v_vehicle_costs"
      referencedColumns: ["vehicle_id"]
    },{
      foreignKeyName: "warranties_vehicle_id_fkey"
      columns: ["vehicle_id"]
isOneToOne: false
      referencedRelation: "vehicle_inventory"
      referencedColumns: ["id"]
    }
                  ]
                },"warranty_claims": {
                  Row: {
                    "costo_reparacion_pen": number | null,"created_at": string,"descripcion": string,"diagnostico": string | null,"estado": Database["public"]['Enums']["claim_status"],"id": string,"registrado_por": string | null,"tecnico_id": string | null,"updated_at": string,"warranty_id": string
                  }
                  Insert: {
                    "costo_reparacion_pen"?: number | null,"created_at"?: string,"descripcion": string,"diagnostico"?: string | null,"estado"?: Database["public"]['Enums']["claim_status"],"id"?: string,"registrado_por"?: string | null,"tecnico_id"?: string | null,"updated_at"?: string,"warranty_id": string
                  }
                  Update: {
                    "costo_reparacion_pen"?: number | null,"created_at"?: string,"descripcion"?: string,"diagnostico"?: string | null,"estado"?: Database["public"]['Enums']["claim_status"],"id"?: string,"registrado_por"?: string | null,"tecnico_id"?: string | null,"updated_at"?: string,"warranty_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "warranty_claims_tecnico_id_fkey"
      columns: ["tecnico_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "warranty_claims_warranty_id_fkey"
      columns: ["warranty_id"]
isOneToOne: false
      referencedRelation: "v_warranties"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "warranty_claims_warranty_id_fkey"
      columns: ["warranty_id"]
isOneToOne: false
      referencedRelation: "warranties"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "v_batch_reconciliation": {
                  Row: {
                    "alerta_baterias": boolean | null,"alerta_faltan_registrar": boolean | null,"alerta_packing_vs_dam": boolean | null,"batch_id": string | null,"cantidad_baterias_12v": number | null,"cantidad_dam": number | null,"cantidad_packing_list": number | null,"codigo_embarque": string | null,"codigo_modelo": string | null,"estado_lote": Database["public"]['Enums']["batch_status"] | null,"nro_dam": string | null,"unidades_baterias_completas": number | null,"unidades_inspeccion_aprobada": number | null,"unidades_registradas": number | null,"voltaje_sistema": number | null
                  }
                  Relationships: [
                    
                  ]
                },"v_price_matrix": {
                  Row: {
                    "batch_id": string | null,"cantidad": number | null,"categoria": Database["public"]['Enums']["vehicle_category"] | null,"codigo_embarque": string | null,"codigo_modelo": string | null,"costo_landing_unitario_pen": number | null,"model_id": string | null,"precio_x1": number | null,"precio_x3": number | null,"precio_x6": number | null,"utilidad_x1": number | null,"utilidad_x3": number | null,"utilidad_x6": number | null
                  }
                  Relationships: [
                    
                  ]
                },"v_sales_margin": {
                  Row: {
                    "cliente_nombre": string | null,"codigo_modelo": string | null,"confirmada_at": string | null,"costo_landing_unitario_pen": number | null,"margen_real": number | null,"numero": number | null,"order_id": string | null,"precio_unitario_pen": number | null,"tipo_venta": Database["public"]['Enums']["sale_type"] | null,"utilidad_pen": number | null,"vin_chasis": string | null
                  }
                  Relationships: [
                    
                  ]
                },"v_stock": {
                  Row: {
                    "amperaje_bateria_ah": number | null,"batch_id": string | null,"baterias_registradas": number | null,"cantidad_baterias_12v": number | null,"categoria": Database["public"]['Enums']["vehicle_category"] | null,"codigo_modelo": string | null,"color_primario": string | null,"color_secundario": string | null,"estado": Database["public"]['Enums']["vehicle_status"] | null,"location_id": string | null,"model_id": string | null,"nro_motor": string | null,"potencia_motor_watts": number | null,"precio_x1": number | null,"precio_x3": number | null,"precio_x6": number | null,"ubicacion": string | null,"ultima_inspeccion_aprobada": boolean | null,"vehicle_id": string | null,"vin_chasis": string | null,"voltaje_sistema": number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "vehicle_inventory_batch_id_model_id_fkey"
      columns: ["batch_id","model_id"]
isOneToOne: false
      referencedRelation: "batch_items"
      referencedColumns: ["batch_id","model_id"]
    },{
      foreignKeyName: "vehicle_inventory_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "vehicle_inventory_model_id_fkey"
      columns: ["model_id"]
isOneToOne: false
      referencedRelation: "v_price_matrix"
      referencedColumns: ["model_id"]
    },{
      foreignKeyName: "vehicle_inventory_model_id_fkey"
      columns: ["model_id"]
isOneToOne: false
      referencedRelation: "vehicle_models"
      referencedColumns: ["id"]
    }
                  ]
                },"v_vehicle_costs": {
                  Row: {
                    "codigo_embarque": string | null,"codigo_modelo": string | null,"costo_landing_calculado_pen": number | null,"estado": Database["public"]['Enums']["vehicle_status"] | null,"nro_motor": string | null,"vehicle_id": string | null,"vin_chasis": string | null
                  }
                  Relationships: [
                    
                  ]
                },"v_warranties": {
                  Row: {
                    "anulada": boolean | null,"cliente_documento": string | null,"cliente_nombre": string | null,"cobertura": Database["public"]['Enums']["warranty_coverage"] | null,"codigo_modelo": string | null,"created_at": string | null,"dias_restantes": number | null,"fecha_fin": string | null,"fecha_inicio": string | null,"id": string | null,"orden_numero": number | null,"order_id": string | null,"vehicle_id": string | null,"vigente": boolean | null,"vin_chasis": string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "warranties_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "sales_orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "warranties_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "v_sales_margin"
      referencedColumns: ["order_id"]
    },{
      foreignKeyName: "warranties_vehicle_id_fkey"
      columns: ["vehicle_id"]
isOneToOne: false
      referencedRelation: "v_stock"
      referencedColumns: ["vehicle_id"]
    },{
      foreignKeyName: "warranties_vehicle_id_fkey"
      columns: ["vehicle_id"]
isOneToOne: false
      referencedRelation: "v_vehicle_costs"
      referencedColumns: ["vehicle_id"]
    },{
      foreignKeyName: "warranties_vehicle_id_fkey"
      columns: ["vehicle_id"]
isOneToOne: false
      referencedRelation: "vehicle_inventory"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "can_edit_order":
{ Args: { "p_order_id": string }; Returns: boolean
                           },
"current_app_role":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["app_role"]
                           },
"fecha_lima":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"generar_lista_precios":
{ Args: { "p_batch_id": string }; Returns: undefined
                           },
"guardar_costeo":
{ Args: { "p_batch_id": string,"p_filas": Json }; Returns: {
              "alquiler_asignado_pen": number,
"armado_pen": number,
"batch_id": string,
"calculado_at": string,
"calculado_por": string | null,
"cantidad": number,
"costo_landing_unitario_pen": number | null,
"costo_total_pen": number | null,
"flete_internacional_asignado_usd": number,
"flete_nacional_asignado_pen": number,
"fob_asignado_usd": number,
"gastos_agente_asignado_usd": number,
"impuestos_asignados_pen": number,
"model_id": string,
"publicidad_asignada_pen": number,
"sueldos_asignado_pen": number,
"tipo_cambio": number
            }[]
                          SetofOptions: {
        from: "*"
        to: "batch_model_costs"
        isOneToOne: false
        isSetofReturn: true
      } },
"has_role":
{ Args: { "roles": (Database["public"]['Enums']["app_role"])[] }; Returns: boolean
                           },
"is_privileged":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_staff":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"pendientes_de_registro":
{ Args: Record<PropertyKey, never>; Returns: {
              "batch_id": string,"codigo_embarque": string,"codigo_modelo": string,"declaradas": number,"estado_lote": Database["public"]['Enums']["batch_status"],"model_id": string,"registradas": number
            }[]
                           },
"precio_unidad":
{ Args: { "p_tipo": Database["public"]['Enums']["sale_type"],"p_vehicle_id": string }; Returns: number
                           },
"recalcular_total_orden":
{ Args: { "p_order_id": string }; Returns: number
                           }
          }
          Enums: {
            "app_role": "admin"|"tecnico"|"vendedor","batch_status": "en_transito"|"en_aduanas"|"en_almacen"|"liquidado","claim_status": "abierto"|"en_revision"|"aprobado"|"rechazado"|"cerrado","document_type": "DNI"|"RUC"|"CE","location_type": "almacen"|"showroom"|"taller","order_status": "borrador"|"confirmada"|"anulada","payment_method": "efectivo"|"transferencia"|"tarjeta"|"mixto","sale_type": "unidad_x1"|"mayorista_x3"|"distribuidor_x6","vehicle_category": "bicimoto"|"trimoto_pasajeros"|"trimoto_carga","vehicle_status": "en_caja"|"en_ensamble"|"listo_en_tienda"|"reservado"|"vendido","warranty_coverage": "general"|"baterias"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

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
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "app_role": ["admin", "tecnico", "vendedor"],"batch_status": ["en_transito", "en_aduanas", "en_almacen", "liquidado"],"claim_status": ["abierto", "en_revision", "aprobado", "rechazado", "cerrado"],"document_type": ["DNI", "RUC", "CE"],"location_type": ["almacen", "showroom", "taller"],"order_status": ["borrador", "confirmada", "anulada"],"payment_method": ["efectivo", "transferencia", "tarjeta", "mixto"],"sale_type": ["unidad_x1", "mayorista_x3", "distribuidor_x6"],"vehicle_category": ["bicimoto", "trimoto_pasajeros", "trimoto_carga"],"vehicle_status": ["en_caja", "en_ensamble", "listo_en_tienda", "reservado", "vendido"],"warranty_coverage": ["general", "baterias"]
          }
        }
} as const

