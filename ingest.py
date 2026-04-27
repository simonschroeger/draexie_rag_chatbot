from rag import RAGPipeline

pipeline = RAGPipeline()
n = pipeline.ingest_folder()
print(f"\nDone — {n} chunks indexed.")
