import streamlit as st
from dotenv import load_dotenv
import base64
from pathlib import Path

from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_mistralai import ChatMistralAI        #####
from langchain_core.prompts import ChatPromptTemplate
# pip install langchain-ollama
#from langchain_ollama import ChatOllama

load_dotenv()

st.set_page_config(page_title="DRÄXIE Chatbot", layout="centered")


def image_to_base64(path):
    return base64.b64encode(Path(path).read_bytes()).decode()


logo_path = "assets/draxie.png"
logo_base64 = image_to_base64(logo_path) if Path(logo_path).exists() else None

st.markdown("""
<style>
.stApp {
    background: radial-gradient(circle at top, #30485d 0%, #1d2b3a 45%, #111923 100%);
    color: white;
}

.main .block-container {
    max-width: 920px;
    padding-top: 2rem;
}

.draxie-card {
    text-align: center;
    padding: 28px 20px 18px 20px;
    border-radius: 28px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.12);
    box-shadow: 0 20px 60px rgba(0,0,0,0.25);
    margin-bottom: 28px;
    backdrop-filter: blur(14px);
}

.draxie-logo {
    width: 115px;
    height: 115px;
    object-fit: contain;
    margin-bottom: 10px;
}

.draxie-title {
    font-size: 58px;
    font-weight: 850;
    letter-spacing: 8px;
    color: white;
    line-height: 1;
}

.draxie-title span {
    color: #20d4df;
}

.draxie-subtitle {
    font-size: 14px;
    letter-spacing: 2px;
    color: #d7e6ee;
    margin-top: 12px;
}

.draxie-line {
    width: 120px;
    height: 3px;
    background-color: #20d4df;
    margin: 22px auto 4px auto;
    border-radius: 999px;
}

[data-testid="stChatMessage"] {
    background: rgba(255, 255, 255, 0.075);
    border-radius: 20px;
    padding: 16px;
    margin-bottom: 14px;
    border: 1px solid rgba(255,255,255,0.11);
    box-shadow: 0 10px 30px rgba(0,0,0,0.14);
}

[data-testid="stChatInput"] {
    border-radius: 18px;
}

.stSpinner > div {
    color: #20d4df !important;
}
</style>
""", unsafe_allow_html=True)

if logo_base64:
    logo_html = f'<img class="draxie-logo" src="data:image/png;base64,{logo_base64}">'
else:
    logo_html = '<div style="font-size:80px;">🤖</div>'

st.markdown(f"""
<div class="draxie-card">
    {logo_html}
    <div class="draxie-title">DRÄ<span>X</span>IE</div>
    <div class="draxie-subtitle">DEIN VERTRIEBSBEGLEITER. IMMER AN DEINER SEITE.</div>
    <div class="draxie-line"></div>
</div>
""", unsafe_allow_html=True)


@st.cache_resource(show_spinner=False)
def load_rag_components():
    embeddings = HuggingFaceEmbeddings(
        model_name="BAAI/bge-base-en-v1.5"
    )

    vectorstore = Chroma(
        persist_directory="chroma_db",
        embedding_function=embeddings
    )

    retriever = vectorstore.as_retriever(
        search_type="mmr",
        search_kwargs={
            "k": 4,
            "fetch_k": 10,
            "lambda_mult": 0.5
        }
    )

    llm = ChatMistralAI(
        model="mistral-small-2506",     
        streaming=True
    )

    '''llm = ChatOllama(
    model="llama3.1",
    temperature=0
)'''

    '''pip install langchain-ollama
ollama pull llama3.1
ollama serve'''

    return retriever, llm


retriever, llm = load_rag_components()

prompt = ChatPromptTemplate.from_messages([
    (
        "system",
        """You are DRAXIE, a helpful sales onboarding assistant.

Use ONLY the provided context to answer the question.

Answer clearly, professionally, and in a friendly onboarding style.

If the answer is not present in the context,
say: "I could not find the answer in the document."
"""
    ),
    (
        "human",
        """Context:
{context}

Question:
{question}
"""
    )
])

if "messages" not in st.session_state:
    st.session_state.messages = []

for message in st.session_state.messages:
    avatar = logo_path if message["role"] == "assistant" and Path(logo_path).exists() else None

    if avatar:
        with st.chat_message(message["role"], avatar=avatar):
            st.write(message["content"])
    else:
        with st.chat_message(message["role"]):
            st.write(message["content"])

query = st.chat_input("Frag DRÄXIE etwas...")

if query:
    st.session_state.messages.append({
        "role": "user",
        "content": query
    })

    with st.chat_message("user"):
        st.write(query)

    with st.chat_message("assistant", avatar=logo_path if Path(logo_path).exists() else None):
        status = st.empty()
        response_box = st.empty()

        status.markdown("DRÄXIE sucht in den Dokumenten...")

        docs = retriever.invoke(query)

        context = "\n\n".join(doc.page_content for doc in docs)

        final_prompt = prompt.invoke({
            "context": context,
            "question": query
        })

        status.markdown("DRÄXIE schreibt...")

        full_answer = ""

        for chunk in llm.stream(final_prompt):
            if chunk.content:
                full_answer += chunk.content
                response_box.markdown(full_answer + "▌")

        response_box.markdown(full_answer)
        status.empty()

    st.session_state.messages.append({
        "role": "assistant",
        "content": full_answer
    })




