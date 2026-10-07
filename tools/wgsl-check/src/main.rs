use std::{env, fs, process};

fn main() {
    let mut failed = false;
    for path in env::args().skip(1) {
        let source = fs::read_to_string(&path).expect("read shader");
        let module = match naga::front::wgsl::parse_str(&source) {
            Ok(module) => module,
            Err(error) => {
                eprintln!("{}", error.emit_to_string_with_path(&source, &path));
                failed = true;
                continue;
            }
        };
        let mut validator = naga::valid::Validator::new(
            naga::valid::ValidationFlags::all(),
            naga::valid::Capabilities::all(),
        );
        match validator.validate(&module) {
            Ok(_) => println!("PASS Naga validation: {path}"),
            Err(error) => {
                eprintln!("{}", error.emit_to_string_with_path(&source, &path));
                failed = true;
            }
        }
    }
    if failed {
        process::exit(1);
    }
}
