use std::{collections::HashMap, env, io::Cursor};

use image::{imageops::FilterType, io::Reader as ImageReader, ImageFormat};
use warp::{http::Response, Filter};

#[tokio::main]
async fn main() {
    let port: u16 = env::var("PORT")
        .unwrap_or("3030".to_string())
        .parse()
        .expect("got port");
    let hello = warp::query::<HashMap<String, String>>()
        .then(get_image)
        .map(|(image, format)| {
            Response::builder()
                .header("Content-Type", format!("image/{format}"))
                .body(image)
                .unwrap()
        });

    warp::serve(hello).run(([127, 0, 0, 1], port)).await
}

async fn get_image(map: HashMap<String, String>) -> (Vec<u8>, String) {
    let url = map.get("url").expect("url is present");
    let width: u32 = map
        .get("width")
        .expect("width is present")
        .parse()
        .expect("converting width to u64 successful");
    let format = map.get("format").expect("format is present");
    let resp = reqwest::get(url).await.expect("got image");
    let bytes = resp.bytes().await.expect("got bytes");
    println!("{}", format!("{url} {width} {format}"));
    let mut new_bytes: Vec<u8> = Vec::new();
    match format.as_str() {
        "webp" => {
            ImageReader::new(Cursor::new(bytes))
                .with_guessed_format()
                .unwrap()
                .decode()
                .unwrap()
                .resize(width, 1000000, FilterType::Lanczos3)
                .write_to(&mut Cursor::new(&mut new_bytes), ImageFormat::WebP)
                .expect("image converted to webp");
        }
        "avif" => {
            ImageReader::new(Cursor::new(bytes))
                .with_guessed_format()
                .unwrap()
                .decode()
                .unwrap()
                .resize(width, 1000000, FilterType::Lanczos3)
                .write_to(&mut Cursor::new(&mut new_bytes), ImageFormat::Avif)
                .expect("image converted to avif");
        }
        _ => todo!(),
    }
    (new_bytes, format.to_owned())
}
