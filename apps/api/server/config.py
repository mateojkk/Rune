import os
from pathlib import Path
from typing import Optional
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

try:
    from dotenv import load_dotenv
    env_path = Path(__file__).parent.parent.parent.parent / '.env'
    load_dotenv(env_path)
except ImportError:
    pass


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file='.env',
        env_file_encoding='utf-8',
        extra='ignore',
    )

    network: str = Field(default='testnet', description='Network selection: testnet | mainnet')

    api_host: str = Field(default='0.0.0.0', validation_alias='API_HOST')
    api_port: int = Field(default=3001, validation_alias='API_PORT')

    walrus_publisher_url: Optional[str] = Field(default=None, validation_alias='WALRUS_PUBLISHER_URL')
    walrus_aggregator_url: Optional[str] = Field(default=None, validation_alias='WALRUS_AGGREGATOR_URL')

    seal_package_id: Optional[str] = Field(default=None, validation_alias='SEAL_PACKAGE_ID')
    seal_key_server_1: Optional[str] = Field(default=None, validation_alias='SEAL_KEY_SERVER_1')
    seal_key_server_2: Optional[str] = Field(default=None, validation_alias='SEAL_KEY_SERVER_2')

    database_url: Optional[str] = Field(default=None, validation_alias='DATABASE_URL')
    jwt_secret: str = Field(default='rune-fallback-secret-hackathon-2024', validation_alias='JWT_SECRET')
    jwt_algorithm: str = Field(default='HS256', validation_alias='JWT_ALGORITHM')

    @field_validator('network', mode='before')
    @classmethod
    def normalize_network(cls, v: Optional[str]) -> str:
        if not v or (isinstance(v, str) and v.strip() == ''):
            return 'testnet'
        return v.strip().lower()

    @field_validator('walrus_publisher_url', 'walrus_aggregator_url', 'seal_package_id', 'seal_key_server_1', 'seal_key_server_2', mode='before')
    @classmethod
    def empty_to_none(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        if isinstance(v, str) and v.strip() == '':
            return None
        return v

    @property
    def is_mainnet(self) -> bool:
        return self.network == 'mainnet'

    @property
    def walrus_publisher(self) -> str:
        if self.walrus_publisher_url:
            return self.walrus_publisher_url
        return 'https://publisher.walrus.space' if self.is_mainnet else 'https://publisher.walrus-testnet.walrus.space'

    @property
    def walrus_aggregator(self) -> str:
        if self.walrus_aggregator_url:
            return self.walrus_aggregator_url
        return 'https://aggregator.walrus.space' if self.is_mainnet else 'https://aggregator.walrus-testnet.walrus.space'

    @property
    def seal_package(self) -> str:
        if self.seal_package_id:
            return self.seal_package_id
        return '0xcb83a248bda5f7a0a431e6bf9e96d184e604130ec5218696e3f1211113b447b7'

    @property
    def seal_key_servers(self) -> list[dict]:
        servers = []
        if self.seal_key_server_1:
            servers.append({'objectId': self.seal_key_server_1, 'weight': 1})
        if self.seal_key_server_2:
            servers.append({'objectId': self.seal_key_server_2, 'weight': 1})
        return servers

    def get_public_config(self) -> dict:
        return {
            'network': self.network,
            'isMainnet': self.is_mainnet,
            'walrus': {
                'publisher': self.walrus_publisher,
                'aggregator': self.walrus_aggregator,
            },
            'seal': {
                'packageId': self.seal_package,
                'policyPackageId': self.seal_package,
                'keyServers': self.seal_key_servers,
            },
        }


settings = Settings()


NETWORK = settings.network
API_HOST = settings.api_host
API_PORT = settings.api_port
WALRUS_PUBLISHER_URL = settings.walrus_publisher
WALRUS_AGGREGATOR_URL = settings.walrus_aggregator
SEAL_PACKAGE_ID = settings.seal_package
SEAL_KEY_SERVERS = settings.seal_key_servers
DATABASE_URL = settings.database_url


def get_settings() -> Settings:
    return settings


def get_network() -> str:
    return NETWORK


def is_mainnet() -> bool:
    return settings.is_mainnet