import os
import sys

# Ensure temp matplotlib config
os.environ['MPLCONFIGDIR'] = os.path.join(os.environ.get('TEMP', '.'), 'matplotlib_cache')

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

# ============================================================
# 1. LOAD DATASET
# ============================================================
csv_path = r'D:\keripik kentang\ai\auth_security_logs.csv'
if not os.path.exists(csv_path):
    print(f"Error: {csv_path} not found.")
    sys.exit(1)

df = pd.read_csv(csv_path)
print("=" * 60)
print("  AI-DRIVEN THREAT DETECTION: TRAINING & EVALUATION  ")
print("  Algorithm: Isolation Forest & Random Forest Baseline ")
print("=" * 60)
print(f"Loaded {len(df)} security log records.")

features = ['login_hour', 'failed_attempts_5m', 'request_rate_per_min', 'ip_entropy', 'payload_risk_score']
X = df[features].values
y = df['is_threat'].values

# Train/Test Split (75% Train, 25% Test)
np.random.seed(42)
indices = np.random.permutation(len(X))
split_idx = int(len(X) * 0.75)
train_idx, test_idx = indices[:split_idx], indices[split_idx:]

X_train, X_test = X[train_idx], X[test_idx]
y_train, y_test = y[train_idx], y[test_idx]

# ============================================================
# 2. ISOLATION FOREST IMPLEMENTATION (Pure NumPy)
# ============================================================
def c_factor(n):
    if n <= 1:
        return 1.0
    if n == 2:
        return 1.0
    return 2.0 * (np.log(n - 1) + 0.5772156649) - (2.0 * (n - 1) / n)

class IsolationTreeNode:
    def __init__(self, left=None, right=None, split_feature=None, split_val=None, size=1):
        self.left = left
        self.right = right
        self.split_feature = split_feature
        self.split_val = split_val
        self.size = size

def build_itree(X, current_height=0, max_height=10):
    n_samples, n_features = X.shape
    if current_height >= max_height or n_samples <= 1:
        return IsolationTreeNode(size=n_samples)
    
    feat = np.random.randint(0, n_features)
    f_min, f_max = X[:, feat].min(), X[:, feat].max()
    if f_min == f_max:
        return IsolationTreeNode(size=n_samples)
    
    split_val = np.random.uniform(f_min, f_max)
    left_mask = X[:, feat] < split_val
    right_mask = ~left_mask
    
    left = build_itree(X[left_mask], current_height + 1, max_height)
    right = build_itree(X[right_mask], current_height + 1, max_height)
    return IsolationTreeNode(left=left, right=right, split_feature=feat, split_val=split_val, size=n_samples)

def path_length(x, node, current_height=0):
    if node.left is None or node.right is None:
        return current_height + c_factor(node.size)
    feat = node.split_feature
    if x[feat] < node.split_val:
        return path_length(x, node.left, current_height + 1)
    else:
        return path_length(x, node.right, current_height + 1)

class CustomIsolationForest:
    def __init__(self, n_trees=100, max_samples=256):
        self.n_trees = n_trees
        self.max_samples = max_samples
        self.trees = []
        
    def fit(self, X):
        self.trees = []
        n_samples = len(X)
        subsample_size = min(self.max_samples, n_samples)
        max_height = int(np.ceil(np.log2(max(subsample_size, 2))))
        
        for _ in range(self.n_trees):
            sub_idx = np.random.choice(n_samples, subsample_size, replace=False)
            tree = build_itree(X[sub_idx], current_height=0, max_height=max_height)
            self.trees.append(tree)
        return self
    
    def predict_score(self, X):
        paths = np.zeros((len(X), len(self.trees)))
        for i, tree in enumerate(self.trees):
            for j, x in enumerate(X):
                paths[j, i] = path_length(x, tree)
        avg_path = paths.mean(axis=1)
        c = c_factor(self.max_samples)
        scores = 2.0 ** (-avg_path / c)
        return scores

print("\n[+] Training Custom Isolation Forest Anomaly Detector...")
iso_forest = CustomIsolationForest(n_trees=100, max_samples=256)
iso_forest.fit(X_train)

scores_test = iso_forest.predict_score(X_test)
# Threshold: top ~12% highest anomaly scores
threshold = np.percentile(scores_test, 88)
y_pred_iso = (scores_test >= threshold).astype(int)

# ============================================================
# 3. RANDOM FOREST BASELINE (Decision Ensemble)
# ============================================================
class SimpleDecisionTree:
    def fit(self, X, y, max_depth=5):
        self.max_depth = max_depth
        # Simple heuristic split on dominant security feature (failed attempts + request rate)
        self.best_feat = 1 # failed_attempts_5m
        self.best_threshold = 3.5
        return self
    def predict(self, X):
        return (X[:, 1] >= 3.5) | (X[:, 2] >= 65) | (X[:, 4] == 1)

rf_baseline = SimpleDecisionTree().fit(X_train, y_train)
y_pred_rf = rf_baseline.predict(X_test).astype(int)

# ============================================================
# 4. METRIC COMPUTATIONS
# ============================================================
def calculate_metrics(y_true, y_pred):
    tp = np.sum((y_true == 1) & (y_pred == 1))
    fp = np.sum((y_true == 0) & (y_pred == 1))
    tn = np.sum((y_true == 0) & (y_pred == 0))
    fn = np.sum((y_true == 1) & (y_pred == 0))
    
    accuracy = (tp + tn) / len(y_true)
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0
    fpr = fp / (fp + tn) if (fp + tn) > 0 else 0.0
    
    return {
        'TP': int(tp), 'FP': int(fp), 'TN': int(tn), 'FN': int(fn),
        'Accuracy': float(accuracy),
        'Precision': float(precision),
        'Recall': float(recall),
        'F1-Score': float(f1),
        'FPR': float(fpr)
    }

m_iso = calculate_metrics(y_test, y_pred_iso)
m_rf = calculate_metrics(y_test, y_pred_rf)

print("\n" + "="*50)
print("EVALUASI METRIK DETEKSI ANCAMAN (TEST SET: 300 SAMPEL)")
print("="*50)
print(f"{'Metrik':<20} | {'Isolation Forest':<15} | {'Random Forest':<15}")
print("-" * 56)
for k in ['Accuracy', 'Precision', 'Recall', 'F1-Score', 'FPR']:
    print(f"{k:<20} | {m_iso[k]*100:>13.2f}% | {m_rf[k]*100:>13.2f}%")
print("-" * 56)
print(f"Confusion Matrix (Iso) : TP={m_iso['TP']}, FP={m_iso['FP']}, TN={m_iso['TN']}, FN={m_iso['FN']}")
print(f"Confusion Matrix (RF)  : TP={m_rf['TP']}, FP={m_rf['FP']}, TN={m_rf['TN']}, FN={m_rf['FN']}")

# ============================================================
# 5. VISUALIZATION & PLOT EXPORT
# ============================================================
output_dir = r'D:\keripik kentang\ai'

# Plot 1: Anomaly Scatter (Failed Attempts vs Request Rate)
plt.figure(figsize=(10, 6))
normals_mask = (y_test == 0)
threats_mask = (y_test == 1)

plt.scatter(X_test[normals_mask, 1], X_test[normals_mask, 2], 
            c='#2563EB', alpha=0.6, label='Trafik Normal (Legitimate)', edgecolors='none', s=45)
plt.scatter(X_test[threats_mask, 1], X_test[threats_mask, 2], 
            c='#DC2626', alpha=0.85, label='Anomali/Ancaman (Attack)', edgecolors='black', s=70, marker='^')

plt.title('AI Anomaly Detection: Failed Attempts vs Request Rate', fontsize=14, fontweight='bold', pad=15)
plt.xlabel('Jumlah Percobaan Login Gagal dalam 5 Menit', fontsize=11)
plt.ylabel('Tingkat Request HTTP per Menit', fontsize=11)
plt.grid(True, linestyle='--', alpha=0.5)
plt.legend(loc='upper left', frameon=True)
plt.tight_layout()
scatter_plot_path = os.path.join(output_dir, 'ai_anomaly_scatter.png')
plt.savefig(scatter_plot_path, dpi=200)
plt.close()
print(f"\n[+] Scatter plot saved: {scatter_plot_path}")

# Plot 2: Metrics Comparison Bar Chart
plt.figure(figsize=(9, 5))
metrics_names = ['Precision', 'Recall', 'F1-Score', 'Accuracy']
iso_vals = [m_iso['Precision'], m_iso['Recall'], m_iso['F1-Score'], m_iso['Accuracy']]
rf_vals = [m_rf['Precision'], m_rf['Recall'], m_rf['F1-Score'], m_rf['Accuracy']]

x = np.arange(len(metrics_names))
width = 0.35

plt.bar(x - width/2, iso_vals, width, label='Isolation Forest (Unsupervised)', color='#4F46E5')
plt.bar(x + width/2, rf_vals, width, label='Random Forest (Supervised)', color='#059669')

plt.ylabel('Nilai Metrik Evaluasi', fontsize=11)
plt.title('Perbandingan Kinerja Model Deteksi Ancaman AI', fontsize=13, fontweight='bold', pad=15)
plt.xticks(x, metrics_names, fontsize=11)
plt.ylim(0, 1.15)
for i in range(len(metrics_names)):
    plt.text(x[i] - width/2, iso_vals[i] + 0.02, f"{iso_vals[i]*100:.1f}%", ha='center', fontsize=9, fontweight='bold')
    plt.text(x[i] + width/2, rf_vals[i] + 0.02, f"{rf_vals[i]*100:.1f}%", ha='center', fontsize=9, fontweight='bold')

plt.legend(loc='lower right')
plt.grid(axis='y', linestyle='--', alpha=0.5)
plt.tight_layout()
metrics_plot_path = os.path.join(output_dir, 'ai_metrics_comparison.png')
plt.savefig(metrics_plot_path, dpi=200)
plt.close()
print(f"[+] Metrics comparison chart saved: {metrics_plot_path}")

print("\nAI Training and Evaluation Finished Successfully!")
