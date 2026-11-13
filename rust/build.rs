//! Gera um arquivo de recursos Windows (`.res`) com o ícone do aplicativo e o
//! manifesto (DPI por monitor, estilos visuais, UTF-8) e o entrega ao linker.
//!
//! Feito em Rust puro para não depender de `rc.exe` (MSVC) nem `windres`
//! (MinGW). Tanto o `link.exe` quanto o `lld` aceitam `.res` diretamente.

use std::path::PathBuf;

const RT_ICON: u16 = 3;
const RT_GROUP_ICON: u16 = 14;
const RT_MANIFEST: u16 = 24;
const LANG_NEUTRAL: u16 = 0;

const MANIFEST: &str = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0">
  <assemblyIdentity type="win32" name="TTreter.tImago" version="1.0.0.0"/>
  <dependency>
    <dependentAssembly>
      <assemblyIdentity type="win32" name="Microsoft.Windows.Common-Controls" version="6.0.0.0" processorArchitecture="*" publicKeyToken="6595b64144ccf1df" language="*"/>
    </dependentAssembly>
  </dependency>
  <compatibility xmlns="urn:schemas-microsoft-com:compatibility.v1">
    <application>
      <supportedOS Id="{8e0f7a12-bfb3-4fe8-b9a5-48fd50a15a9a}"/>
    </application>
  </compatibility>
  <application xmlns="urn:schemas-microsoft-com:asm.v3">
    <windowsSettings>
      <dpiAware xmlns="http://schemas.microsoft.com/SMI/2005/WindowsSettings">true/pm</dpiAware>
      <dpiAwareness xmlns="http://schemas.microsoft.com/SMI/2016/WindowsSettings">PerMonitorV2, PerMonitor</dpiAwareness>
      <activeCodePage xmlns="http://schemas.microsoft.com/SMI/2019/WindowsSettings">UTF-8</activeCodePage>
      <longPathAware xmlns="http://schemas.microsoft.com/SMI/2016/WindowsSettings">true</longPathAware>
    </windowsSettings>
  </application>
  <trustInfo xmlns="urn:schemas-microsoft-com:asm.v3">
    <security>
      <requestedPrivileges>
        <requestedExecutionLevel level="asInvoker" uiAccess="false"/>
      </requestedPrivileges>
    </security>
  </trustInfo>
</assembly>
"#;

/// Acrescenta um recurso (tipo e nome numéricos) no formato binário `.res`.
fn push_resource(out: &mut Vec<u8>, kind: u16, id: u16, memory_flags: u16, data: &[u8]) {
    out.extend((data.len() as u32).to_le_bytes()); // DataSize
    out.extend(32u32.to_le_bytes()); // HeaderSize
    out.extend([0xFF, 0xFF]);
    out.extend(kind.to_le_bytes());
    out.extend([0xFF, 0xFF]);
    out.extend(id.to_le_bytes());
    out.extend(0u32.to_le_bytes()); // DataVersion
    out.extend(memory_flags.to_le_bytes());
    out.extend(LANG_NEUTRAL.to_le_bytes());
    out.extend(0u32.to_le_bytes()); // Version
    out.extend(0u32.to_le_bytes()); // Characteristics
    out.extend(data);
    while out.len() % 4 != 0 {
        out.push(0);
    }
}

fn main() {
    println!("cargo:rerun-if-changed=build.rs");
    println!("cargo:rerun-if-changed=../build/icon.ico");

    if std::env::var_os("CARGO_CFG_WINDOWS").is_none() {
        return;
    }

    let mut res = Vec::new();
    push_resource(&mut res, 0, 0, 0, &[]); // cabeçalho que marca um .res de 32 bits

    // Ícone: cada imagem do .ico vira um RT_ICON; o diretório vira um RT_GROUP_ICON
    let ico = std::fs::read("../build/icon.ico").expect("build/icon.ico");
    let count = u16::from_le_bytes([ico[4], ico[5]]) as usize;
    let mut group = ico[..6].to_vec();
    for index in 0..count {
        let entry = &ico[6 + index * 16..6 + (index + 1) * 16];
        let size = u32::from_le_bytes(entry[8..12].try_into().unwrap()) as usize;
        let offset = u32::from_le_bytes(entry[12..16].try_into().unwrap()) as usize;
        let id = index as u16 + 1;
        push_resource(&mut res, RT_ICON, id, 0x1010, &ico[offset..offset + size]);
        group.extend(&entry[..12]);
        group.extend(id.to_le_bytes());
    }
    push_resource(&mut res, RT_GROUP_ICON, 1, 0x1030, &group);
    push_resource(&mut res, RT_MANIFEST, 1, 0x1030, MANIFEST.as_bytes());

    let path = PathBuf::from(std::env::var_os("OUT_DIR").expect("OUT_DIR")).join("timago.res");
    std::fs::write(&path, res).expect("gravar timago.res");
    println!("cargo:rustc-link-arg-bins={}", path.display());
}
