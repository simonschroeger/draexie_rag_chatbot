#1 load pdf
#2 split into chunks
#3 create the embeddings
#4 store into chroma db

import os
from langchain_community.document_loaders import PyPDFLoader, TextLoader, UnstructuredPowerPointLoader, UnstructuredExcelLoader, Docx2txtLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.embeddings import HuggingFaceBgeEmbeddings
from langchain_community.vectorstores import Chroma
from dotenv import load_dotenv

load_dotenv()

docs = []

folder_path = "document loaders"

for file in os.listdir(folder_path):

    path = os.path.join(folder_path, file)

    if file.endswith(".pdf"):

        docs.extend(PyPDFLoader(path).load())

    elif file.endswith(".txt"):

        docs.extend(TextLoader(path).load())

    elif file.endswith(".pptx"):

        docs.extend(UnstructuredPowerPointLoader(path).load())

    elif file.endswith(".xlsx"):

        docs.extend(UnstructuredExcelLoader(path).load())
    
    elif file.endswith(".docx"):

        docs.extend(Docx2txtLoader(path).load())


splitter = RecursiveCharacterTextSplitter(
    chunk_size = 1000,
    chunk_overlap = 200
)


chunks = splitter.split_documents(docs)

embedding_model = HuggingFaceBgeEmbeddings(model_name = "BAAI/bge-base-en-v1.5")

vectorstore = Chroma.from_documents(
    documents=chunks,
    embedding=embedding_model,
    persist_directory="chroma_db"
)

