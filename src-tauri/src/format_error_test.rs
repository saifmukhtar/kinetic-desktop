use kinetic_sdk::apis::Error;

pub fn format_error<T>(err: Error<T>) -> String {
    match err {
        Error::ResponseError(mut content) => {
            let status = content.status;
            let text = content.content.clone();
            format!("{{\"code\": \"API_ERROR\", \"status\": {}, \"message\": {}}}", status.as_u16(), serde_json::to_string(&text).unwrap())
        },
        Error::Reqwest(e) => format!("{{\"code\": \"NETWORK_ERROR\", \"message\": {}}}", serde_json::to_string(&e.to_string()).unwrap()),
        Error::Serde(e) => format!("{{\"code\": \"PARSE_ERROR\", \"message\": {}}}", serde_json::to_string(&e.to_string()).unwrap()),
        Error::Io(e) => format!("{{\"code\": \"IO_ERROR\", \"message\": {}}}", serde_json::to_string(&e.to_string()).unwrap()),
    }
}
