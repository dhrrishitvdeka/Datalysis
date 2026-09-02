import numpy as np
import pandas as pd

def generate_messy_titanic(n_rows: int = 250) -> pd.DataFrame:
    np.random.seed(42)
    p_ids = [f"PASS_{1000 + i}" for i in range(n_rows)]
    survived = np.random.binomial(1, 0.38, n_rows)
    pclass = np.random.choice([1, 2, 3], size=n_rows, p=[0.24, 0.21, 0.55])
    sex = np.random.choice(["male", "female"], size=n_rows, p=[0.64, 0.36])
    
    # Skewed Age with 20% missing
    age = np.random.gamma(shape=5, scale=6, size=n_rows) # Skewed
    age[np.random.choice(n_rows, int(n_rows * 0.20), replace=False)] = np.nan

    sibsp = np.random.choice([0, 1, 2, 3, 4], size=n_rows, p=[0.68, 0.23, 0.05, 0.02, 0.02])
    parch = np.random.choice([0, 1, 2], size=n_rows, p=[0.76, 0.16, 0.08])

    # Extreme right-skew Fare with massive outliers
    fare = np.random.exponential(scale=25, size=n_rows) + 5
    fare[np.random.choice(n_rows, 8, replace=False)] = np.random.uniform(250, 520, 8) # Extreme outliers

    # Cabin with 78% missing
    cabins = [f"{c}{np.random.randint(10, 120)}" for c in ['C', 'B', 'D', 'E']]
    cabin = np.random.choice(cabins, size=n_rows)
    cabin_arr = cabin.astype(object)
    cabin_arr[np.random.choice(n_rows, int(n_rows * 0.78), replace=False)] = np.nan

    # Embarked with 2% missing
    embarked = np.random.choice(["S", "C", "Q"], size=n_rows, p=[0.70, 0.20, 0.10]).astype(object)
    embarked[np.random.choice(n_rows, int(n_rows * 0.02), replace=False)] = np.nan

    # Constant column
    data_source = ["North_Atlantic_Manifest"] * n_rows

    df = pd.DataFrame({
        "PassengerId": p_ids,
        "Survived": survived,
        "Pclass": pclass,
        "Sex": sex,
        "Age": np.round(age, 1),
        "SibSp": sibsp,
        "Parch": parch,
        "Fare": np.round(fare, 2),
        "Cabin": cabin_arr,
        "Embarked": embarked,
        "Manifest_Source": data_source
    })

    # Add 3 duplicate rows
    dups = df.iloc[[5, 12, 45]].copy()
    df = pd.concat([df, dups], ignore_index=True)
    return df

def generate_messy_telecom_churn(n_rows: int = 300) -> pd.DataFrame:
    np.random.seed(101)
    c_ids = [f"CUST-{hex(100000 + i)[2:].upper()}" for i in range(n_rows)]
    tenure = np.random.randint(1, 72, size=n_rows).astype(float)
    tenure[np.random.choice(n_rows, int(n_rows * 0.08), replace=False)] = np.nan

    monthly_charges = np.random.uniform(20.0, 118.0, size=n_rows)
    # Collinear total_charges (monthly_charges * tenure + noise)
    total_charges = np.nan_to_num(tenure, nan=12.0) * monthly_charges + np.random.normal(0, 15, size=n_rows)
    total_charges = np.maximum(total_charges, 20.0)

    contract = np.random.choice(["Month-to-month", "One year", "Two year"], size=n_rows, p=[0.55, 0.25, 0.20])
    service_tier = np.random.choice(["Bronze", "Silver", "Gold", "Platinum"], size=n_rows)
    payment = np.random.choice(["Electronic check", "Mailed check", "Bank transfer", "Credit card"], size=n_rows)
    
    # Skewed complaints count with outliers
    complaints = np.random.poisson(lam=0.4, size=n_rows)
    complaints[np.random.choice(n_rows, 5, replace=False)] = np.random.randint(7, 14, 5)

    churned = np.random.binomial(1, 0.26, n_rows)
    system_code = ["TELCO_CORE_V2"] * n_rows

    df = pd.DataFrame({
        "CustomerID": c_ids,
        "TenureMonths": np.round(tenure, 0),
        "MonthlyCharges": np.round(monthly_charges, 2),
        "TotalCharges": np.round(total_charges, 2),
        "ContractType": contract,
        "ServiceTier": service_tier,
        "PaymentMethod": payment,
        "CustomerComplaints": complaints,
        "Churned": churned,
        "System_Flag": system_code
    })
    return df

def generate_sensor_telemetry(n_rows: int = 200) -> pd.DataFrame:
    np.random.seed(202)
    dates = pd.date_range(start="2026-03-01 00:00:00", periods=n_rows, freq="h")
    device_uuid = [f"sens-09a8-{i:04d}" for i in range(n_rows)]
    
    temp = 22.0 + np.random.normal(0, 3.5, size=n_rows)
    temp[np.random.choice(n_rows, int(n_rows * 0.12), replace=False)] = np.nan
    temp[np.random.choice(n_rows, 4, replace=False)] = [85.2, 92.4, -40.0, 78.9] # Outliers

    humidity = np.clip(55.0 + np.random.normal(0, 12.0, size=n_rows), 10, 95)
    pressure = 101.3 + np.random.normal(0, 0.8, size=n_rows)
    status = np.random.choice(["Normal", "Warning", "Critical"], size=n_rows, p=[0.82, 0.14, 0.04])
    static_calib = [100.0] * n_rows

    df = pd.DataFrame({
        "Timestamp": dates.strftime("%Y-%m-%d %H:%M:%S"),
        "DeviceUUID": device_uuid,
        "Temperature_C": np.round(temp, 2),
        "Humidity_Pct": np.round(humidity, 1),
        "Pressure_kPa": np.round(pressure, 2),
        "OperatingStatus": status,
        "StaticCalibration": static_calib
    })
    return df

SAMPLE_GENERATORS = {
    "titanic": {"name": "Messy Titanic Passengers (Classification)", "generator": generate_messy_titanic, "description": "High missingness in Cabin, skewed Fare, missing Age, PassengerId leakage, duplicate records."},
    "telecom": {"name": "Messy Telecom Customer Churn", "generator": generate_messy_telecom_churn, "description": "High collinearity (Monthly vs Total Charges), ordinal ServiceTier, CustomerID identifier, missing tenure."},
    "sensors": {"name": "IoT Sensor & Telemetry Log", "generator": generate_sensor_telemetry, "description": "Datetime timestamps, extreme temperature outliers, missing readings, static calibration constant."}
}
