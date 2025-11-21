use keyring::Entry;
use crate::constants::KEYCHAIN_SERVICE_NAME;

pub fn save_password_to_keychain(connection_name: &str, password: &str) -> Result<(), String> {
    let entry = Entry::new(KEYCHAIN_SERVICE_NAME, connection_name)
        .map_err(|e| format!("Failed to create keychain entry: {}", e))?;

    entry
        .set_password(password)
        .map_err(|e| format!("Failed to save password to keychain: {}", e))?;

    Ok(())
}

pub fn get_password_from_keychain(connection_name: &str) -> Result<Option<String>, String> {
    let entry = Entry::new(KEYCHAIN_SERVICE_NAME, connection_name)
        .map_err(|e| format!("Failed to create keychain entry: {}", e))?;

    match entry.get_password() {
        Ok(password) => Ok(Some(password)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("Failed to get password from keychain: {}", e)),
    }
}

pub fn delete_password_from_keychain(connection_name: &str) -> Result<(), String> {
    let entry = Entry::new(KEYCHAIN_SERVICE_NAME, connection_name)
        .map_err(|e| format!("Failed to create keychain entry: {}", e))?;

    match entry.delete_credential() {
        Ok(_) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()), // Already deleted
        Err(e) => Err(format!("Failed to delete password from keychain: {}", e)),
    }
}
