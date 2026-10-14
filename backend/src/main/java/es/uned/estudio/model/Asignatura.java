package es.uned.estudio.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;

import java.time.LocalDateTime;

@Entity
public class Asignatura {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String codigo;

    @Column(nullable = false)
    private String nombre;

    private String libro;

    @Column(nullable = false)
    private LocalDateTime examenSemana1;

    @Column(nullable = false)
    private LocalDateTime examenSemana2;

    /** Semana de exámenes a la que se presenta el estudiante: 1 o 2. */
    @Column(nullable = false)
    private int semanaElegida = 1;

    protected Asignatura() {
    }

    public Asignatura(String codigo, String nombre, String libro,
                      LocalDateTime examenSemana1, LocalDateTime examenSemana2) {
        this.codigo = codigo;
        this.nombre = nombre;
        this.libro = libro;
        this.examenSemana1 = examenSemana1;
        this.examenSemana2 = examenSemana2;
    }

    public LocalDateTime getFechaExamen() {
        return semanaElegida == 2 ? examenSemana2 : examenSemana1;
    }

    /** Actualiza los datos que vienen de la guía; conserva la semana elegida por el estudiante. */
    public void actualizarDatos(String nombre, String libro,
                                LocalDateTime examenSemana1, LocalDateTime examenSemana2) {
        this.nombre = nombre;
        this.libro = libro;
        this.examenSemana1 = examenSemana1;
        this.examenSemana2 = examenSemana2;
    }

    public Long getId() {
        return id;
    }

    public String getCodigo() {
        return codigo;
    }

    public String getNombre() {
        return nombre;
    }

    public String getLibro() {
        return libro;
    }

    public LocalDateTime getExamenSemana1() {
        return examenSemana1;
    }

    public LocalDateTime getExamenSemana2() {
        return examenSemana2;
    }

    public int getSemanaElegida() {
        return semanaElegida;
    }

    public void setSemanaElegida(int semanaElegida) {
        this.semanaElegida = semanaElegida;
    }
}
