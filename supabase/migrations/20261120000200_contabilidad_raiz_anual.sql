-- La carpeta raíz configurada pasa a ser la del año (02_2026), cuyas
-- subcarpetas son los meses. Se procesa todo lo que hay dentro, incluidos
-- los archivos sueltos de la carpeta del año.
update contabilidad.configuracion
set valor = '{"solo_carpetas_con_anio": false, "incluir_raiz": true, "excluir": []}'::jsonb,
    descripcion = 'Carpetas del Drive que se procesan dentro de la raíz configurada (DRIVE_ROOT_FOLDER_ID)'
where clave = 'drive_filtro';
