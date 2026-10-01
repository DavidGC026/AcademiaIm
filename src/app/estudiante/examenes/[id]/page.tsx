'use client';

import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Clock, 
  CheckCircle, 
  XCircle, 
  HelpCircle,
  Award,
  AlertTriangle
} from 'lucide-react';

interface Option {
  id: number;
  pregunta_id: number;
  texto: string;
}

interface Question {
  id: number;
  pregunta: string;
  tipo: string;
  opciones: Option[];
}

interface Exam {
  id: number;
  curso_id: number;
  titulo: string;
  descripcion: string;
  limite_tiempo: number;
}

export default function ExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: examId } = React.use(params);
  const router = useRouter();

  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Quiz states
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [correctAnswers, setCorrectAnswers] = useState<Record<number, number>>({});
  
  // Timer states
  const [timeLeft, setTimeLeft] = useState<number>(0); // in seconds
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchExamDetails = async () => {
    try {
      const res = await fetch(`/api/examenes/${examId}`);
      if (res.ok) {
        const data = await res.json();
        setExam(data.exam);
        setQuestions(data.preguntas);
        
        // Start timer if time limit exists
        if (data.exam.limite_tiempo > 0) {
          setTimeLeft(data.exam.limite_tiempo * 60);
        }
      } else {
        console.error('Error al cargar examen');
      }
    } catch (e) {
      console.error('Error del servidor', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExamDetails();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [examId]);

  // Handle timer countdown
  useEffect(() => {
    if (timeLeft > 0 && !submitted) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            handleAutoSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timeLeft, submitted]);

  const handleSelectOption = (questionId: number, optionId: number) => {
    if (submitted) return;
    setAnswers({
      ...answers,
      [questionId]: optionId
    });
  };

  const submitExam = async (finalAnswers: Record<number, number>) => {
    if (submitting || submitted) return;
    setSubmitting(true);
    if (timerRef.current) clearInterval(timerRef.current);

    try {
      const res = await fetch(`/api/examenes/${examId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ respuestas: finalAnswers }),
      });

      if (res.ok) {
        const data = await res.json();
        setScore(data.calificacion);
        setCorrectAnswers(data.respuestasCorrectas);
        setSubmitted(true);
      } else {
        alert('Error al calificar el examen');
      }
    } catch (error) {
      console.error('Error al enviar el examen:', error);
      alert('Error de conexión');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if all questions are answered
    const answeredCount = Object.keys(answers).length;
    if (answeredCount < questions.length) {
      if (!confirm(`Has respondido ${answeredCount} de ${questions.length} preguntas. ¿Seguro que deseas enviar el examen?`)) {
        return;
      }
    }
    submitExam(answers);
  };

  const handleAutoSubmit = () => {
    alert('¡El tiempo se ha agotado! Tu examen será enviado automáticamente.');
    submitExam(answers);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return <div style={styles.loading}>Cargando examen...</div>;
  }

  if (!exam) {
    return (
      <div style={styles.container}>
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <AlertTriangle size={48} color="var(--danger)" style={{ marginBottom: '16px' }} />
          <h4>Examen no encontrado</h4>
          <Link href="/estudiante" style={styles.backLink}>
            <ArrowLeft size={16} /> Volver a Cursos
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <Link href="/estudiante" style={styles.backLink}>
        <ArrowLeft size={16} /> Volver a Mis Cursos
      </Link>

      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>{exam.titulo}</h1>
          <p style={styles.subtitle}>{exam.descripcion || 'Lee con atención cada una de las siguientes preguntas y selecciona la respuesta correcta.'}</p>
        </div>

        {exam.limite_tiempo > 0 && !submitted && (
          <div style={styles.timerCard}>
            <Clock size={18} color="#0073A5" />
            <span style={styles.timerText}>{formatTime(timeLeft)}</span>
          </div>
        )}
      </div>

      {submitted && score !== null && (
        <div className="card" style={styles.resultCard}>
          <div style={styles.resultLeft}>
            <Award size={48} color="#0073A5" />
            <div>
              <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#0073A5', marginBottom: '4px' }}>
                Examen Completado
              </h2>
              <p style={{ fontSize: '14px', color: '#64748B' }}>
                Tu calificación ha sido calculada automáticamente en base a tus respuestas correctas.
              </p>
            </div>
          </div>
          <div style={styles.scoreCircle}>
            <span style={styles.scoreNumber}>{Math.round(score)}</span>
            <span style={styles.scoreMax}>/100</span>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.questionsList}>
          {questions.map((q, qIdx) => {
            const isQuestionCorrect = submitted && correctAnswers[q.id] === answers[q.id];
            const studentSelectedOptionId = answers[q.id];
            const correctOptionId = correctAnswers[q.id];

            return (
              <div 
                key={q.id} 
                className="card" 
                style={{ 
                  ...styles.questionCard,
                  ...(submitted ? (isQuestionCorrect ? styles.correctCardBorder : styles.incorrectCardBorder) : {})
                }}
              >
                <div style={styles.questionHeader}>
                  <span style={styles.questionNumber}>Pregunta {qIdx + 1} de {questions.length}</span>
                  {submitted && (
                    isQuestionCorrect ? (
                      <span style={{ ...styles.statusIndicator, color: 'var(--success)' }}>
                        <CheckCircle size={16} /> Correcto
                      </span>
                    ) : (
                      <span style={{ ...styles.statusIndicator, color: 'var(--danger)' }}>
                        <XCircle size={16} /> Incorrecto
                      </span>
                    )
                  )}
                </div>
                <h3 style={styles.questionText}>{q.pregunta}</h3>

                <div style={styles.optionsList}>
                  {q.opciones.map((opt) => {
                    const isSelected = studentSelectedOptionId === opt.id;
                    const isOptionCorrect = submitted && correctOptionId === opt.id;
                    const isOptionIncorrectAndSelected = submitted && isSelected && !isQuestionCorrect;

                    let optionStyle = { ...styles.optionItem };
                    if (isSelected) optionStyle = { ...optionStyle, ...styles.optionSelected };
                    if (isOptionCorrect) optionStyle = { ...optionStyle, ...styles.optionCorrect };
                    if (isOptionIncorrectAndSelected) optionStyle = { ...optionStyle, ...styles.optionIncorrect };

                    return (
                      <div 
                        key={opt.id}
                        onClick={() => handleSelectOption(q.id, opt.id)}
                        style={optionStyle}
                      >
                        <div style={styles.radioIndicator}>
                          {isSelected && <div style={styles.radioDot} />}
                        </div>
                        <span style={styles.optionText}>{opt.texto}</span>
                        {submitted && isOptionCorrect && (
                          <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--success)', fontWeight: 'bold' }}>
                            Respuesta Correcta
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {!submitted ? (
          <button 
            type="submit" 
            className="btn btn-primary" 
            style={styles.submitBtn} 
            disabled={submitting}
          >
            {submitting ? 'Enviando respuestas...' : 'Finalizar y Entregar Examen'}
          </button>
        ) : (
          <button 
            type="button" 
            onClick={() => router.push('/estudiante')} 
            className="btn btn-secondary" 
            style={styles.submitBtn}
          >
            Volver al Panel del Estudiante
          </button>
        )}
      </form>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '800px',
    margin: '0 auto',
    paddingBottom: '60px',
  },
  backLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    color: '#0073A5',
    fontWeight: '700',
    textDecoration: 'none',
    marginBottom: '20px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '28px',
  },
  title: {
    fontSize: '28px',
    fontWeight: '800',
    color: '#0073A5',
    marginBottom: '6px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#64748B',
    maxWidth: '560px',
  },
  timerCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 18px',
    backgroundColor: '#FFFFFF',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    boxShadow: 'var(--shadow-sm)',
  },
  timerText: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#0073A5',
    fontFamily: 'monospace',
  },
  resultCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    border: '1.5px solid #0073A5',
    borderRadius: '16px',
    padding: '24px',
    marginBottom: '32px',
    boxShadow: '0 8px 30px rgba(0, 115, 165, 0.08)',
  },
  resultLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  },
  scoreCircle: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    backgroundColor: 'rgba(0, 115, 165, 0.08)',
    border: '2px solid #0073A5',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreNumber: {
    fontSize: '24px',
    fontWeight: '800',
    color: '#0073A5',
    lineHeight: '1',
  },
  scoreMax: {
    fontSize: '11px',
    color: '#64748B',
    fontWeight: '600',
  },
  form: {
    width: '100%',
  },
  questionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  questionCard: {
    padding: '24px',
    backgroundColor: '#FFFFFF',
    border: '1px solid var(--border)',
    borderRadius: '14px',
    transition: 'border-color 0.2s ease',
  },
  correctCardBorder: {
    borderColor: 'rgba(16, 185, 129, 0.4)',
    boxShadow: '0 4px 15px rgba(16, 185, 129, 0.04)',
  },
  incorrectCardBorder: {
    borderColor: 'rgba(239, 68, 68, 0.4)',
    boxShadow: '0 4px 15px rgba(239, 68, 68, 0.04)',
  },
  questionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  questionNumber: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#B0B3B5',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  statusIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '12px',
    fontWeight: '700',
  },
  questionText: {
    fontSize: '16px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    lineHeight: '1.4',
    marginBottom: '20px',
  },
  optionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  optionItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px 16px',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    backgroundColor: '#FFFFFF',
  },
  optionSelected: {
    borderColor: '#0073A5',
    backgroundColor: 'rgba(0, 115, 165, 0.03)',
  },
  optionCorrect: {
    borderColor: 'var(--success)',
    backgroundColor: 'rgba(16, 185, 129, 0.06)',
  },
  optionIncorrect: {
    borderColor: 'var(--danger)',
    backgroundColor: 'rgba(239, 68, 68, 0.06)',
  },
  radioIndicator: {
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    border: '2px solid #B0B3B5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  radioDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    backgroundColor: '#0073A5',
  },
  optionText: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    fontWeight: '500',
  },
  submitBtn: {
    width: '100%',
    padding: '16px',
    fontSize: '15px',
    fontWeight: '700',
    marginTop: '32px',
    borderRadius: '10px',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '400px',
    fontSize: '16px',
    fontWeight: '500',
    color: '#0073A5',
  },
};
