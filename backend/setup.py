from setuptools import setup, find_packages

setup(
    name="prediction_service",
    version="0.1",
    packages=find_packages(),
    install_requires=[
        "fastapi",
        "uvicorn",
        "numpy",
        "pandas",
        "statsmodels",
        "aiohttp",
        "redis",
    ],
) 