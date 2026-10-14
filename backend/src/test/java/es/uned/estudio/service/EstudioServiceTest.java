package es.uned.estudio.service;

import es.uned.estudio.web.Dtos.ActividadDia;
import es.uned.estudio.web.Dtos.AsignaturaDetalle;
import es.uned.estudio.web.Dtos.AsignaturaResumen;
import es.uned.estudio.web.Dtos.TemaNodo;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = "spring.datasource.url=jdbc:h2:mem:test;DB_CLOSE_DELAY=-1")
@Transactional
class EstudioServiceTest {

    private static final ZoneId MADRID = ZoneId.of("Europe/Madrid");

    @TestConfiguration
    static class RelojFijo {
        @Bean
        @Primary
        Clock relojFijo() {
            return Clock.fixed(Instant.parse("2026-10-14T10:00:00Z"), MADRID);
        }
    }

    @Autowired
    EstudioService service;

    @Test
    void cargaLasDosAsignaturasOrdenadasPorFechaDeExamen() {
        List<AsignaturaResumen> asignaturas = service.listar();

        assertThat(asignaturas).extracting(AsignaturaResumen::codigo).containsExactly("69011017", "62013065");
        assertThat(asignaturas.get(0).fechaExamen()).isEqualTo(LocalDateTime.of(2027, 1, 26, 11, 30));
        assertThat(asignaturas.get(0).diasRestantes()).isEqualTo(104);
        assertThat(asignaturas.get(1).diasRestantes()).isEqualTo(107);
        assertThat(asignaturas).allSatisfy(a -> {
            assertThat(a.totalApartados()).isPositive();
            assertThat(a.apartadosEstudiados()).isZero();
        });
    }

    @Test
    void cambiarDeSemanaRecalculaLaFechaYLosDias() {
        AsignaturaResumen sociologia = service.listar().get(0);

        AsignaturaResumen cambiada = service.cambiarSemana(sociologia.id(), 2);

        assertThat(cambiada.fechaExamen()).isEqualTo(LocalDateTime.of(2027, 2, 9, 18, 30));
        assertThat(cambiada.diasRestantes()).isEqualTo(118);
    }

    @Test
    void marcarUnTemaMarcaTodaSuRamaYDesmarcarUnaHojaDesmarcaSusAntecesores() {
        TemaNodo tema3 = temaDeGrupos(2);

        AsignaturaDetalle tras = service.marcarTema(tema3.id(), true);
        TemaNodo marcado = tras.temario().get(2);
        assertThat(todos(marcado)).allMatch(TemaNodo::estudiado);
        assertThat(marcado.fechaEstudiado()).isEqualTo(LocalDate.of(2026, 10, 14));
        assertThat(marcado.apartadosEstudiados()).isEqualTo(marcado.totalApartados());

        TemaNodo apartado3 = marcado.hijos().get(2);
        TemaNodo normas = apartado3.hijos().get(0).hijos().get(0);
        assertThat(normas.titulo()).startsWith("3.1.1.");

        TemaNodo desmarcado = service.marcarTema(normas.id(), false).temario().get(2);
        assertThat(desmarcado.estudiado()).isFalse();
        assertThat(desmarcado.hijos().get(2).estudiado()).isFalse();
        assertThat(desmarcado.hijos().get(2).hijos().get(0).estudiado()).isFalse();
        assertThat(desmarcado.hijos().get(1).estudiado()).isTrue();
        assertThat(desmarcado.apartadosEstudiados()).isEqualTo(desmarcado.totalApartados() - 1);
    }

    @Test
    void marcarTodosLosHijosMarcaAlPadre() {
        TemaNodo tema1 = temaDeGrupos(0);
        TemaNodo apartado4 = tema1.hijos().get(3);

        AsignaturaDetalle tras = null;
        for (TemaNodo hijo : apartado4.hijos()) {
            tras = service.marcarTema(hijo.id(), true);
        }

        assertThat(tras.temario().get(0).hijos().get(3).estudiado()).isTrue();
        assertThat(tras.temario().get(0).estudiado()).isFalse();
    }

    @Test
    void laActividadCuentaLosApartadosEstudiadosCadaDia() {
        assertThat(service.actividad()).isEmpty();

        TemaNodo tema3 = temaDeGrupos(2);
        service.marcarTema(tema3.id(), true);

        List<ActividadDia> actividad = service.actividad();
        assertThat(actividad).singleElement().satisfies(d -> {
            assertThat(d.fecha()).isEqualTo(LocalDate.of(2026, 10, 14));
            assertThat(d.asignaturaId()).isEqualTo(service.listar().get(1).id());
            assertThat(d.apartados()).isEqualTo(tema3.totalApartados());
        });
    }

    private TemaNodo temaDeGrupos(int indice) {
        Long grupos = service.listar().get(1).id();
        return service.detalle(grupos).temario().get(indice);
    }

    private static List<TemaNodo> todos(TemaNodo nodo) {
        return Stream.concat(
                Stream.of(nodo),
                nodo.hijos().stream().flatMap(h -> todos(h).stream())).toList();
    }
}
