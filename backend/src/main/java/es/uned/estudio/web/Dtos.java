package es.uned.estudio.web;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public final class Dtos {

    private Dtos() {
    }

    public record AsignaturaResumen(
            Long id,
            String codigo,
            String nombre,
            String libro,
            LocalDateTime examenSemana1,
            LocalDateTime examenSemana2,
            int semanaElegida,
            LocalDateTime fechaExamen,
            long diasRestantes,
            int totalApartados,
            int apartadosEstudiados) {
    }

    public record TemaNodo(
            Long id,
            String titulo,
            boolean estudiado,
            LocalDate fechaEstudiado,
            int totalApartados,
            int apartadosEstudiados,
            List<TemaNodo> hijos) {
    }

    public record AsignaturaDetalle(AsignaturaResumen resumen, List<TemaNodo> temario) {
    }

    /** Apartados (hojas del temario) de una asignatura marcados como estudiados en un día. */
    public record ActividadDia(LocalDate fecha, Long asignaturaId, int apartados) {
    }

    public record CambioSemana(@NotNull @Min(1) @Max(2) Integer semana) {
    }

    public record CambioEstudiado(@NotNull Boolean estudiado) {
    }
}
