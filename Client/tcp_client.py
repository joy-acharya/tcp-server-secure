import socket
import json
from base64 import b64encode, b64decode
from Crypto.Cipher import AES
from Crypto.Random import get_random_bytes
from Crypto.Hash import SHA256
from Crypto.Protocol.KDF import HKDF
from Crypto.Util.number import long_to_bytes, bytes_to_long

from cryptography.hazmat.primitives.asymmetric import dh
from cryptography.hazmat.backends import default_backend

def encrypt(key, data):
    iv = get_random_bytes(12)
    cipher = AES.new(key, AES.MODE_GCM, nonce=iv)
    ciphertext, tag = cipher.encrypt_and_digest(data)
    return {
        "iv": b64encode(iv).decode(),
        "tag": b64encode(tag).decode(),
        "ciphertext": b64encode(ciphertext).decode()
    }

def decrypt(key, payload):
    iv = b64decode(payload["iv"])
    tag = b64decode(payload["tag"])
    ciphertext = b64decode(payload["ciphertext"])
    cipher = AES.new(key, AES.MODE_GCM, nonce=iv)
    return cipher.decrypt_and_verify(ciphertext, tag)

def main():
    MODP14_P_HEX = (
        "FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD129024E08"
        "8A67CC74020BBEA63B139B22514A08798E3404DDEF9519B3CD"
        "3A431B302B0A6DF25F14374FE1356D6D51C245E485B576625E"
        "7EC6F44C42E9A637ED6B0BFF5CB6F406B7EDEE386BFB5A899F"
        "A5AE9F24117C4B1FE649286651ECE65381FFFFFFFFFFFFFFFF"
    )
    MODP14_P = int(MODP14_P_HEX, 16)
    MODP14_G = 2

    param_numbers = dh.DHParameterNumbers(MODP14_P, MODP14_G)
    parameters = param_numbers.parameters(default_backend())

    client_private_key = parameters.generate_private_key()
    client_public_key_int = client_private_key.public_key().public_numbers().y
    client_pub_bytes = long_to_bytes(client_public_key_int)

    with socket.create_connection(("127.0.0.1", 9000)) as sock:
        print("[CLIENT] Connected")

        # Send handshake
        handshake = {
            "event": "handshake",
            "publicKey": b64encode(client_pub_bytes).decode()
        }
        sock.send(json.dumps(handshake).encode())
        print("[CLIENT] Handshake sent")

        # Receive server pub key
        response = sock.recv(4096)
        msg = json.loads(response.decode())
        server_pub_bytes = b64decode(msg["publicKey"])
        server_pub_int = bytes_to_long(server_pub_bytes)
        server_pub_key = dh.DHPublicNumbers(server_pub_int, param_numbers).public_key(default_backend())
        shared_secret = client_private_key.exchange(server_pub_key)
        shared_key = HKDF(shared_secret, 32, b"", SHA256)

        print("[CLIENT] Derived key")

        # Send encrypted message
        encrypted = encrypt(shared_key, b"Hello from client!")
        message = {
            "event": "message",
            "payload": encrypted
        }
        sock.send(json.dumps(message).encode())
        print("[CLIENT] Sent encrypted message")

        # Receive reply
        reply = sock.recv(4096)
        reply_obj = json.loads(reply.decode())
        plaintext = decrypt(shared_key, reply_obj["payload"])
        print("[CLIENT] Received:", plaintext.decode())

if __name__ == "__main__":
    main()