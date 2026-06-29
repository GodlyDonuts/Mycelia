use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PullRequest {
    pub node_id: String,
    pub node_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrainingTask {
    pub round_id: String,
    pub round: u32,
    pub adapter: Vec<f64>,
    pub local_steps: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubmitRequest {
    pub node_id: String,
    pub round_id: String,
    pub delta: Vec<f64>,
    pub loss_before: f64,
    pub loss_after: f64,
}

pub struct CoordinatorClient {
    base_url: String,
    pub node_id: Option<String>,
    client: reqwest::Client,
}

impl CoordinatorClient {
    pub fn new(base_url: impl Into<String>) -> Self {
        Self {
            base_url: base_url.into(),
            node_id: None,
            client: reqwest::Client::new(),
        }
    }

    pub async fn register(&mut self, name: &str, gpu_model: &str) -> Result<String, reqwest::Error> {
        let body = serde_json::json!({
            "name": name,
            "kind": "gpu",
            "gpuModel": gpu_model,
        });
        let resp: serde_json::Value = self
            .client
            .post(format!("{}/api/nodes/register", self.base_url))
            .json(&body)
            .send()
            .await?
            .json()
            .await?;
        let id = resp["id"].as_str().unwrap_or("").to_string();
        self.node_id = Some(id.clone());
        Ok(id)
    }

    pub async fn pull(&self) -> Result<Option<TrainingTask>, reqwest::Error> {
        let node_id = self.node_id.as_deref().unwrap_or("");
        let body = serde_json::json!({ "nodeId": node_id, "nodeName": "rust-cell" });
        let resp: serde_json::Value = self
            .client
            .post(format!("{}/api/training/pull", self.base_url))
            .json(&body)
            .send()
            .await?
            .json()
            .await?;
        if resp["task"].is_null() {
            return Ok(None);
        }
        let t = &resp["task"];
        Ok(Some(TrainingTask {
            round_id: t["roundId"].as_str().unwrap_or("").into(),
            round: t["round"].as_u64().unwrap_or(0) as u32,
            adapter: t["adapter"]
                .as_array()
                .map(|a| a.iter().filter_map(|v| v.as_f64()).collect())
                .unwrap_or_default(),
            local_steps: t["localSteps"].as_u64().unwrap_or(100) as u32,
        }))
    }
}
