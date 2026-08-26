# `@skandia/ui` — tarball vendorizado

Paquete construido localmente desde `SkCo.Fidu.DesignSystem.Lib.UX` porque el feed privado de
Azure Artifacts (`pkgs.dev.azure.com/SkandiaCo/_packaging/SkCoFidu/npm/registry/`) no está
configurado en este entorno. Ver `docs/skandia-ui-adoption.md` para el plan completo.

## Origen

- Repo: https://github.com/UxplorersColombia/SkCo.Fidu.DesignSystem.Lib.UX
- Commit: `afa0fe96316be720927fe020f4b9eef7ffa646cf` ("select a dropdown, autocomplete, blockUI, confirm dialog")
- Paquete: `@skandia/ui@0.1.10`

## Cómo se generó

```bash
cd SkCo.Fidu.DesignSystem.Lib.UX
npm run build:lib   # falla al final en generate-catalog-json.mjs/copy-claude-tools.mjs
                     # (scripts inexistentes en scripts/ — no bloquean; dist/skandia-ui
                     # ya quedó construido correctamente por ng-packagr antes de ese punto)
cd dist/skandia-ui
npm pack --pack-destination ../..
# copiar el .tgz resultante a Alma-Frontend-Angular/vendor/skandia-ui/
```

## Cómo actualizarlo

1. Repetir los pasos de arriba desde un commit más reciente de `SkCo.Fidu.DesignSystem.Lib.UX`.
2. Reemplazar el `.tgz` en esta carpeta.
3. Actualizar la línea `"@skandia/ui": "file:vendor/skandia-ui/skandia-ui-X.Y.Z.tgz"` en
   `package.json` si cambió el número de versión.
4. `npm install` en la raíz de Alma.

## Cuándo dejar de usar esto

En cuanto el feed privado `SkCoFidu` esté configurado y autenticado en este entorno, reemplazar
la dependencia `file:` por `"@skandia/ui": "^0.1.10"` (o la versión publicada correspondiente) y
borrar esta carpeta.
