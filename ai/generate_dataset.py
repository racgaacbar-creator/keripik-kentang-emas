import numpy as np
import pandas as pd
import os

# Set seed for reproducibility
np.random.seed(42)

n_samples = 1200
n_anomalies = 150
n_normals = n_samples - n_anomalies

# 1. Normal traffic (Users, regular customers & staff)
# Login hour: mostly business hours (8-21), failed attempts: 0 or 1, request rate: 5-35 req/min
normal_hour = np.clip(np.random.normal(loc=14, scale=3.5, size=n_normals), 6, 23).astype(int)
normal_failed = np.random.choice([0, 1, 2], size=n_normals, p=[0.85, 0.12, 0.03])
normal_rate = np.clip(np.random.normal(loc=18, scale=6, size=n_normals), 2, 45).astype(int)
normal_entropy = np.clip(np.random.normal(loc=0.15, scale=0.08, size=n_normals), 0.0, 0.4)
normal_payload = np.random.choice([0, 1], size=n_normals, p=[0.99, 0.01])
normal_label = np.zeros(n_normals, dtype=int)

# 2. Anomalous / Adversarial traffic (Brute force, credential stuffing, scraping bot)
# Login hour: off-hours (0-5 or random spikes), high failed attempts, high request rate
p_dist = [0.08]*6 + [0.015]*12 + [0.05666666666666667]*6
p_dist = np.array(p_dist) / np.sum(p_dist)
anomaly_hour = np.random.choice(np.arange(0, 24), size=n_anomalies, p=p_dist)
anomaly_failed = np.random.randint(4, 30, size=n_anomalies)
anomaly_rate = np.clip(np.random.normal(loc=120, scale=35, size=n_anomalies), 50, 300).astype(int)
anomaly_entropy = np.clip(np.random.normal(loc=0.75, scale=0.15, size=n_anomalies), 0.4, 1.0)
anomaly_payload = np.random.choice([0, 1], size=n_anomalies, p=[0.4, 0.6])
anomaly_label = np.ones(n_anomalies, dtype=int)

# Combine datasets
data = pd.DataFrame({
    'login_hour': np.concatenate([normal_hour, anomaly_hour]),
    'failed_attempts_5m': np.concatenate([normal_failed, anomaly_failed]),
    'request_rate_per_min': np.concatenate([normal_rate, anomaly_rate]),
    'ip_entropy': np.concatenate([normal_entropy, anomaly_entropy]),
    'payload_risk_score': np.concatenate([normal_payload, anomaly_payload]),
    'is_threat': np.concatenate([normal_label, anomaly_label])
})

# Shuffle dataset
data = data.sample(frac=1, random_state=42).reset_index(drop=True)

output_dir = r'D:\keripik kentang\ai'
os.makedirs(output_dir, exist_ok=True)
csv_path = os.path.join(output_dir, 'auth_security_logs.csv')
data.to_csv(csv_path, index=False)

print(f"Dataset generated successfully at: {csv_path}")
print(f"Total samples : {len(data)}")
print(f"Normal logs   : {n_normals} ({n_normals/len(data)*100:.1f}%)")
print(f"Anomalies     : {n_anomalies} ({n_anomalies/len(data)*100:.1f}%)")
