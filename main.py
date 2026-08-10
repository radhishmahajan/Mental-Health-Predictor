import joblib
from fastapi import FastAPI
import pandas as pd
from pydantic import BaseModel, Field
from typing import Literal
from fastapi.middleware.cors import CORSMiddleware
model=joblib.load('Mental_Health_Model.pkl')

app=FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_headers=["*"], 
    allow_methods=["*"])

class StudentData(BaseModel):
    Age: int = Field(..., gt=0, le=100, description="Age of the student in years")
    Gender: Literal['Male', 'Female'] = Field(..., description="Gender of the student")
    Country: str = Field(..., description="Country of the student")
    Academic_Level: Literal['Undergraduate', 'Graduate', 'High School'] = Field(..., description="Academic level of the student")
    Most_Used_Platform:Literal['Facebook', 'LinkedIn', 'Instagram', 'Snapchat', 'Twitter','YouTube', 'TikTok', 'LINE', 'KakaoTalk', 'VKontakte', 'WhatsApp','WeChat'] = Field(..., description="Most used platform by the student")
    Purpose_Of_Use: Literal['Networking', 'Education', 'Entertainment', 'News'] = Field(..., description="Purpose of using the platform")
    Avg_Daily_Usage_Hours: float = Field(..., gt=0,le=24, description="Average daily usage hours")
    Daily_Unlocks: int = Field(..., gt=0, le=1000, description="Number of times the student unlocks their device daily")
    Study_Hours: float = Field(..., gt=0,le=24, description="Average study hours per day")
    Physical_Activity_Hours: float = Field(..., gt=0,le=24, description="Average physical activity hours per day")
    Sleep_Hours_Per_Night: float = Field(..., gt=0,le=24, description="Average sleep hours per night")
    Stress_Level: Literal['Low', 'Medium', 'High'] = Field(..., description="Self-reported stress level")


class PredictionResponse(BaseModel):
    predicted_mental_health_score:float



@app.get("/")
def greet():
    return{"message": "Welcome to the Mental Health Prediction API!"}

top_countries=['Other','India','USA','Canada','Australia','UK','Germany','Mexico','Turkey','France']
@app.post("/predict",response_model=PredictionResponse)
def predict(data: StudentData):
    country_group=data.Country if data.Country in top_countries else 'Other'
    input_row=pd.DataFrame([{
        'Age': data.Age,
        'Gender': data.Gender,
        'Country': data.Country,
        'Academic_Level': data.Academic_Level,
        'Most_Used_Platform': data.Most_Used_Platform,
        'Purpose_Of_Use': data.Purpose_Of_Use,
        'Avg_Daily_Usage_Hours': data.Avg_Daily_Usage_Hours,
        'Daily_Unlocks': data.Daily_Unlocks,
        'Study_Hours': data.Study_Hours,
        'Physical_Activity_Hours': data.Physical_Activity_Hours,
        'Sleep_Hours_Per_Night': data.Sleep_Hours_Per_Night,
        'Stress_Level': data.Stress_Level,
        'Grouped_country':country_group
    }])


    prediction = model.predict(input_row)[0]
    return PredictionResponse(predicted_mental_health_score=round(float(prediction),2))