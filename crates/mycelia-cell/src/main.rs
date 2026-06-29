use mycelia_cell::CoordinatorClient;

#[tokio::main]
async fn main() {
    let base = std::env::var("MYCELIA_COORDINATOR").unwrap_or_else(|_| "http://localhost:3000".into());
    let mut client = CoordinatorClient::new(base);
    let id = client.register("rust-cell-01", "RTX4090").await.expect("register");
    println!("[mycelia-cell] joined mesh as {id}");

    loop {
        match client.pull().await {
            Ok(Some(task)) => println!("[mycelia-cell] round {} adapter dim {}", task.round, task.adapter.len()),
            Ok(None) => tokio::time::sleep(std::time::Duration::from_secs(2)).await,
            Err(e) => {
                eprintln!("[mycelia-cell] pull error: {e}");
                tokio::time::sleep(std::time::Duration::from_secs(5)).await;
            }
        }
    }
}
