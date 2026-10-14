package es.uned.estudio.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;

import java.time.LocalDate;

/**
 * Nodo del árbol de temario: tema, apartado o subapartado.
 * Un nodo con hijos se considera estudiado cuando lo están todos sus hijos.
 */
@Entity
public class Tema {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    private Asignatura asignatura;

    @ManyToOne(fetch = FetchType.LAZY)
    private Tema padre;

    @Column(nullable = false, length = 500)
    private String titulo;

    @Column(nullable = false)
    private int orden;

    @Column(nullable = false)
    private boolean estudiado;

    private LocalDate fechaEstudiado;

    protected Tema() {
    }

    public Tema(Asignatura asignatura, Tema padre, String titulo, int orden) {
        this.asignatura = asignatura;
        this.padre = padre;
        this.titulo = titulo;
        this.orden = orden;
    }

    public void marcar(boolean estudiado, LocalDate hoy) {
        if (this.estudiado == estudiado) {
            return;
        }
        this.estudiado = estudiado;
        this.fechaEstudiado = estudiado ? hoy : null;
    }

    public Long getId() {
        return id;
    }

    public Asignatura getAsignatura() {
        return asignatura;
    }

    public Long getPadreId() {
        return padre == null ? null : padre.getId();
    }

    public String getTitulo() {
        return titulo;
    }

    public int getOrden() {
        return orden;
    }

    public boolean isEstudiado() {
        return estudiado;
    }

    public LocalDate getFechaEstudiado() {
        return fechaEstudiado;
    }
}
